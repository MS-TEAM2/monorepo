"use client";

import { Barcode, Camera, ImageUp, Layers, Search, Sun, Tag, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Corners } from "@/components/scan/focus";
import { TabScreen } from "@/components/shell/bottom-nav";
import { useAppInfo } from "@/hooks/use-app-info";
import { callApp, canCallApp } from "@/lib/bridge";
import { prepareUpload } from "@/lib/prototype/image";
import { hashBytes } from "@/lib/prototype/recognition";
import { base64ToBytes, MAX_ATTEMPTS, setPendingScan, toSubjectBox } from "@/lib/prototype/scan-session";
import { cn } from "@/lib/utils";
import { supportsRequest } from "@ax/bridge";

type Issue = "dark" | "empty";

/** 다시 찍을 때 카메라 화면에 띄울 안내. 왜 실패했는지에 맞춘다 */
const RETRY_HINT: Record<Issue | "none", string> = {
  none: "조금 더 가까이, 포장 앞면이 꽉 차게 비춰 주세요",
  dark: "어두웠어요. 플래시를 켜고 다시 비춰 주세요",
  empty: "상품이 안 보였어요. 네모 안에 상품을 크게 비춰 주세요",
};

const RETRY_NOTICE: Record<Issue | "none", string> = {
  none: "상품을 확실히 찾지 못했어요. 다시 비춰 주세요.",
  dark: "사진이 너무 어두웠어요. 플래시를 켜거나 밝은 곳에서 다시 비춰 주세요.",
  empty: "사진에서 상품이 보이지 않았어요. 상품 앞면이 크게 나오게 비춰 주세요.",
};

/** 앱을 처음 열었을 때 한 번만 카메라를 자동으로 연다 */
const LAUNCH_KEY = "hwanseung-lens-launched";

function firstLaunch(): boolean {
  try {
    if (window.sessionStorage.getItem(LAUNCH_KEY)) return false;
    window.sessionStorage.setItem(LAUNCH_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

const TIPS = [
  { icon: Camera, label: "앞면이 보이게" },
  { icon: Layers, label: "하나만" },
  { icon: Sun, label: "밝은 곳에서" },
];

/**
 * 렌즈 탭. 카메라 앱처럼 밤색 화면에 뷰파인더와 셔터를 둔다.
 * - 앱(브리지 2 이상): 셔터가 네이티브 카메라를 연다. 앱을 처음 열 때, 렌즈 탭을 눌렀을 때, 다시 찍을 때
 *   카메라가 바로 뜬다. 결과에서 뒤로 돌아왔을 때는 뜨지 않는다.
 * - 브라우저·구버전 앱: 셔터와 뷰파인더가 사진 올리기다(휴대폰에서는 바로 찍을 수도 있다). 끌어다 놓기도 된다.
 */
export function LensScreen() {
  const app = useAppInfo();
  const live = supportsRequest(app, "scanProduct");
  const params = useSearchParams();
  const attempt = clampAttempt(params.get("attempt"));
  const issue = toIssue(params.get("issue"));
  const autoStart = params.get("scan") === "1" || attempt > 1;

  return (
    <TabScreen
      current="lens"
      tone="dark"
      title={
        <span className="flex items-center gap-2">
          {/* 로고 자리: 노란 가격표 */}
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-unit text-ink">
            <Tag className="size-4" strokeWidth={2.4} />
          </span>
          환승결제
        </span>
      }
    >
      {attempt > 1 ? (
        <RetryNotice attempt={attempt} issue={issue} />
      ) : (
        <div className="animate-rise-in">
          <h2 className="text-[26px] leading-[1.25] tracking-[-0.03em] text-on-night">
            진열대 상품,
            <br />
            온라인이 더 쌀까요?
          </h2>
          <p className="mt-2 text-[15px] text-on-night-2">비추면 쿠팡·네이버쇼핑의 100g당 가격을 비교해 드려요.</p>
        </div>
      )}
      {live ? (
        // 주소가 바뀌면(렌즈 탭을 다시 누름 등) 새로 마운트해서 자동 열기를 다시 판단한다
        <LiveScan key={params.toString()} attempt={attempt} issue={issue} autoStart={autoStart} />
      ) : (
        <UploadScan attempt={attempt} />
      )}
    </TabScreen>
  );
}

function clampAttempt(raw: string | null) {
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= MAX_ATTEMPTS ? value : 1;
}

function toIssue(raw: string | null): Issue | "none" {
  return raw === "dark" || raw === "empty" ? raw : "none";
}

function RetryNotice({ attempt, issue }: { attempt: number; issue: Issue | "none" }) {
  return (
    <div role="status" className="flex animate-pop-in gap-3 rounded-2xl bg-unit px-4 py-3.5 text-ink">
      <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-[15px] leading-snug font-medium">
        {RETRY_NOTICE[issue]} {MAX_ATTEMPTS - attempt + 1}번 더 안 되면 바코드로 찾아요.
      </p>
    </div>
  );
}

function LiveScan({ attempt, issue, autoStart }: { attempt: number; issue: Issue | "none"; autoStart: boolean }) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const started = useRef(false);

  const start = async () => {
    if (!canCallApp("scanProduct")) return;
    setScanning(true);
    try {
      const result = await callApp(
        "scanProduct",
        { attempt, hint: attempt > 1 ? RETRY_HINT[issue] : undefined },
        { timeoutMs: null },
      );
      if (result.status === "cancelled") return;
      setPendingScan({
        image: `data:image/jpeg;base64,${result.imageBase64}`,
        seed: hashBytes(base64ToBytes(result.imageBase64)),
        attempt,
        source: "live",
        subject: toSubjectBox(result.subject),
      });
      router.push("/analyzing");
    } catch (error) {
      toast.error("카메라를 열지 못했어요", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setScanning(false);
    }
  };

  // 렌즈 탭을 누르거나 다시 찍을 때, 앱을 처음 열 때 바로 카메라를 띄운다. 닫으면 다시 열지 않고 셔터로 연다.
  // 화면이 그려진 뒤에 연다. 개발 모드의 effect 두 번 실행에도 한 번만 열리게 타이머를 취소한다.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      const first = firstLaunch();
      if (autoStart || first) void start();
    }, 0);
    return () => clearTimeout(timer);
    // 처음 한 번만 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LensStage
      busy={scanning}
      shutterIcon={Camera}
      shutterLabel={scanning ? "카메라가 열려 있어요" : "카메라 열기"}
      caption={scanning ? "카메라가 열려 있어요" : "상품을 인식하는 순간 자동으로 찍어요"}
      onShutter={() => void start()}
    />
  );
}

function UploadScan({ attempt }: { attempt: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("사진 파일만 올릴 수 있어요. JPG나 PNG를 골라 주세요.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const { dataUrl, seed } = await prepareUpload(file);
      setPendingScan({ image: dataUrl, seed, attempt, source: "upload" });
      router.push("/analyzing");
    } catch {
      setError("사진을 읽지 못했어요. 다른 사진으로 다시 올려 주세요.");
      setBusy(false);
    }
  };

  return (
    <>
      <LensStage
        busy={busy}
        dragging={dragging}
        shutterIcon={ImageUp}
        shutterLabel={busy ? "사진을 준비하고 있어요" : "상품 사진 올리기"}
        caption={busy ? "사진을 준비하고 있어요" : "셔터를 눌러 상품 사진을 찍거나 골라 올려요"}
        error={error}
        onShutter={() => input.current?.click()}
        dropZone={{
          onDragOver: (event) => {
            event.preventDefault();
            setDragging(true);
          },
          onDragLeave: () => setDragging(false),
          onDrop: (event) => {
            event.preventDefault();
            setDragging(false);
            void handle(event.dataTransfer.files[0]);
          },
        }}
      />
      <input
        ref={input}
        type="file"
        accept="image/*"
        name="product-photo"
        aria-label="상품 사진"
        className="sr-only"
        onChange={(event) => {
          void handle(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </>
  );
}

/**
 * 뷰파인더 + 셔터 줄. 카메라 앱의 아래쪽 조작부처럼 왼쪽 바코드, 가운데 셔터, 오른쪽 상품명 검색.
 * 셔터는 엄지가 닿는 화면 아래쪽에 둔다.
 */
function LensStage({
  busy,
  dragging = false,
  shutterIcon: ShutterIcon,
  shutterLabel,
  caption,
  error,
  onShutter,
  dropZone,
}: {
  busy: boolean;
  dragging?: boolean;
  shutterIcon: typeof Camera;
  shutterLabel: string;
  caption: string;
  error?: string | null;
  onShutter: () => void;
  dropZone?: Pick<React.ComponentProps<"div">, "onDragOver" | "onDragLeave" | "onDrop">;
}) {
  return (
    <section aria-label="렌즈" className="mt-5 flex flex-1 flex-col">
      <div
        {...dropZone}
        className={cn(
          "relative flex min-h-[260px] flex-1 overflow-hidden rounded-[28px] bg-night-2 transition-shadow duration-150",
          dragging && "ring-2 ring-unit",
        )}
      >
        <Viewfinder />
        <ul className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5 px-3" aria-label="잘 찍는 법">
          {TIPS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex h-8 items-center gap-1.5 rounded-full bg-night/75 px-3 text-[12px] font-bold whitespace-nowrap text-on-night backdrop-blur"
            >
              <Icon className="size-3.5 text-unit" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-start">
        <SideAction href="/barcode?mode=scan" icon={Barcode} label="바코드" />
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={onShutter}
            disabled={busy}
            aria-label={shutterLabel}
            className="grid size-[78px] place-items-center rounded-full border-4 border-on-night p-1 transition-[transform,opacity] duration-150 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-unit active:scale-95 disabled:opacity-60"
          >
            <span className="grid size-full place-items-center rounded-full bg-unit text-ink">
              <ShutterIcon className="size-7" strokeWidth={2.2} aria-hidden />
            </span>
          </button>
        </div>
        <SideAction href="/barcode?mode=search" icon={Search} label="상품명" />
      </div>
      <p className="mt-3 text-center text-[13px] text-on-night-2" aria-live="polite">
        {caption}
      </p>
      {error ? (
        <p className="mt-1 text-center text-[14px] font-bold text-unit" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function SideAction({ href, icon: Icon, label }: { href: string; icon: typeof Camera; label: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-1.5 pt-2 text-[12px] font-bold text-on-night-2 outline-none"
    >
      <span className="grid size-12 place-items-center rounded-full bg-night-2 text-on-night transition-transform duration-150 group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-unit group-active:scale-90">
        <Icon className="size-[22px]" aria-hidden />
      </span>
      {label}
    </Link>
  );
}

/** 카메라 화면을 미리 보여 주는 뷰파인더: 노란 초점 모서리와 위아래로 움직이는 스캔 선 */
function Viewfinder() {
  return (
    <div aria-hidden className="absolute inset-x-[15%] top-[12%] bottom-[24%]">
      <Corners size="size-9" weight="thick" />
      <p className="absolute inset-0 grid place-items-center px-4 text-center text-[15px] leading-snug text-on-night-2">
        과자·음료 앞면을
        <br />
        네모 안에 비춰 주세요
      </p>
      <span
        className="absolute inset-x-5 top-4 h-[3px] rounded-full bg-unit shadow-[0_0_12px_var(--unit)] motion-safe:animate-[scan-sweep_1.6s_ease-in-out_infinite_alternate]"
        style={{ "--sweep-distance": "min(12rem, 26dvh)" } as React.CSSProperties}
      />
    </div>
  );
}
