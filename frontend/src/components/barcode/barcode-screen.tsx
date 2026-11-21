"use client";

import { Barcode, ImageUp, Search, TriangleAlert } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { ProductRow } from "@/components/product/product-row";
import { Corners } from "@/components/scan/focus";
import { TabScreen } from "@/components/shell/bottom-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppInfo } from "@/hooks/use-app-info";
import { callApp, canCallApp } from "@/lib/bridge";
import { PRODUCTS, productTitle } from "@/lib/prototype/products";
import { findByBarcode, searchProducts } from "@/lib/prototype/recognition";
import { supportsRequest } from "@ax/bridge";

/** 브라우저 내장 바코드 인식기 (크롬 안드로이드 등). 없으면 번호 입력만 한다. 새 의존성을 피하려고 쓴다 */
type Detector = { detect(image: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

const noop = () => () => {};

/** 공백·하이픈을 빼고 8~14자리 숫자면 바코드로 본다 */
function isBarcode(text: string) {
  return /^\d{8,14}$/.test(text.replace(/[\s-]/g, ""));
}
const hasBarcodeDetector = () => typeof window !== "undefined" && "BarcodeDetector" in window;

/**
 * 바코드 탭이자, 렌즈가 세 번 실패했을 때의 예외 화면.
 * 위: 바코드 스캔(앱은 네이티브 카메라, 브라우저는 바코드 사진) / 아래: 상품명 또는 바코드 번호 입력.
 */
export function BarcodeScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const failed = params.get("reason") === "lens-failed";
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("mode") === "search") field.current?.focus();
  }, [params]);

  const openProduct = (id: string, via: "barcode" | "search") =>
    router.push(`/product?id=${id}&via=${via}&from=barcode`);

  const lookup = (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    if (isBarcode(text)) {
      const product = findByBarcode(text);
      if (product) return openProduct(product.id, "barcode");
      return setSubmitted(text);
    }
    const matches = searchProducts(text);
    if (matches.length === 1) return openProduct(matches[0].id, "search");
    setSubmitted(text);
  };

  const results = submitted ? searchProducts(submitted) : [];

  return (
    <TabScreen current="barcode" title="바코드">
      {failed ? (
        <div role="status" className="mb-4 flex animate-pop-in gap-3 rounded-2xl bg-unit-soft px-4 py-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px] leading-snug">
            사진으로 세 번 찾지 못했어요. 바코드를 찍거나 상품명을 입력해 주세요.
          </p>
        </div>
      ) : null}

      <BarcodeScan onCode={(code) => lookup(code)} autoStart={params.get("mode") === "scan"} />

      <section aria-labelledby="manual-title" className="mt-8">
        <h2 id="manual-title" className="text-[18px]">
          직접 입력해서 찾기
        </h2>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            lookup(query);
          }}
        >
          <Label htmlFor="lookup" className="sr-only">
            상품명 또는 바코드 번호
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-2"
                aria-hidden
              />
              <Input
                ref={field}
                id="lookup"
                name="lookup"
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="예: 새우깡, 8800000000001"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-[52px] rounded-full border-transparent bg-shelf pl-11 text-base focus-visible:border-ink focus-visible:bg-tag"
              />
            </div>
            <Button type="submit" size="lg" className="h-[52px] rounded-full px-6">
              찾기
            </Button>
          </div>
        </form>

        {submitted ? (
          results.length > 0 ? (
            <ul className="mt-4 divide-y divide-line" aria-label="검색 결과">
              {results.map((product, index) => (
                <ProductRow
                  key={product.id}
                  index={index}
                  product={product}
                  href={`/product?id=${product.id}&via=search&from=barcode`}
                />
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-2xl bg-shelf px-4 py-5" role="status">
              {isBarcode(submitted) ? (
                <>
                  <p className="font-bold">아직 등록되지 않은 바코드예요</p>
                  <p className="mt-1 text-[15px] text-ink-2">
                    번호를 다시 확인하거나, 포장에 적힌 상품명으로 찾아 주세요.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-bold">‘{submitted}’에 맞는 상품이 없어요</p>
                  <p className="mt-1 text-[15px] text-ink-2">
                    지금은 과자·음료 샘플 {PRODUCTS.length}개만 찾을 수 있어요. 이름을 짧게 넣어 보세요.
                  </p>
                </>
              )}
            </div>
          )
        ) : null}
      </section>

      <SampleCodes onPick={(code) => lookup(code)} />
    </TabScreen>
  );
}

function BarcodeScan({ onCode, autoStart }: { onCode: (code: string) => void; autoStart: boolean }) {
  const app = useAppInfo();
  const native = supportsRequest(app, "scanBarcode");
  const detector = useSyncExternalStore(noop, hasBarcodeDetector, () => false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const scanNative = async () => {
    if (!canCallApp("scanBarcode")) return;
    setBusy(true);
    try {
      const result = await callApp("scanBarcode", {}, { timeoutMs: null });
      if (result.status === "scanned") onCode(result.code);
    } catch (error) {
      toast.error("카메라를 열지 못했어요", { description: error instanceof Error ? error.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!native || !autoStart || started.current) return;
    started.current = true;
    void scanNative();
    // 처음 한 번만 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native, autoStart]);

  const scanPhoto = async (picked: File | undefined) => {
    if (!picked) return;
    setBusy(true);
    try {
      const Ctor = (window as unknown as { BarcodeDetector: DetectorConstructor }).BarcodeDetector;
      const codes = await new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] }).detect(
        await createImageBitmap(picked),
      );
      if (codes[0]) onCode(codes[0].rawValue);
      else toast("바코드를 읽지 못했어요", { description: "바코드가 크게 나오게 다시 찍거나 번호를 입력해 주세요." });
    } catch {
      toast.error("사진을 읽지 못했어요");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="scan-title" className="overflow-hidden rounded-[28px] bg-night text-on-night">
      <BarcodeFinder />
      <div className="flex flex-col gap-2 px-5 pt-1 pb-5">
        <h2 id="scan-title" className="text-[22px] leading-tight text-on-night">
          바코드로 정확하게 찾기
        </h2>
        <p className="max-w-[32ch] text-[15px] text-on-night-2">
          {native
            ? "포장 뒷면의 바코드를 비추면 바로 읽어요."
            : detector
              ? "바코드가 크게 나온 사진을 올리면 번호를 읽어요."
              : "이 브라우저는 바코드를 읽지 못해요. 아래에 번호를 입력하거나 앱에서 스캔해 주세요."}
        </p>
        {native ? (
          <Button
            type="button"
            size="lg"
            className="mt-2 h-[52px] w-full rounded-xl bg-unit text-[16px] text-ink hover:bg-unit/90"
            disabled={busy}
            onClick={() => void scanNative()}
          >
            <Barcode className="size-5" aria-hidden />
            {busy ? "카메라가 열려 있어요" : "바코드 스캔하기"}
          </Button>
        ) : detector ? (
          <>
            <input
              ref={file}
              type="file"
              accept="image/*"
              name="barcode-photo"
              aria-label="바코드 사진"
              className="sr-only"
              onChange={(event) => {
                void scanPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <Button
              type="button"
              size="lg"
              className="mt-2 h-[52px] w-full rounded-xl bg-unit text-[16px] text-ink hover:bg-unit/90"
              disabled={busy}
              onClick={() => file.current?.click()}
            >
              <ImageUp className="size-5" aria-hidden />
              {busy ? "읽는 중" : "바코드 사진 올리기"}
            </Button>
          </>
        ) : null}
      </div>
    </section>
  );
}

/** 프로토타입 확인용: 샘플 상품의 바코드 번호 */
function SampleCodes({ onPick }: { onPick: (code: string) => void }) {
  return (
    <section aria-labelledby="samples-title" className="mt-10">
      <h2 id="samples-title" className="text-[16px]">
        시험용 바코드
      </h2>
      <p className="mt-0.5 text-sm text-ink-2">샘플 데이터라 실제 상품 바코드와 달라요. 눌러서 흐름을 확인해 보세요.</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {PRODUCTS.slice(0, 4).map((product) => (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onPick(product.barcode)}
              className="min-h-11 rounded-full bg-shelf px-3.5 text-sm transition-[background-color,transform] duration-150 outline-none hover:bg-shelf-2 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:bg-shelf-2"
            >
              <span className="font-bold">{productTitle(product)}</span> <span className="num">{product.barcode}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 바코드 뷰파인더 그림: 가로로 긴 노란 초점 모서리와 가운데 빨간 인식 선 */
function BarcodeFinder() {
  return (
    <div aria-hidden className="relative mx-5 mt-5 mb-4 h-28 rounded-2xl bg-night-2">
      <div className="absolute inset-x-[14%] inset-y-5">
        <Corners size="size-6" />
        <Barcode className="absolute inset-0 m-auto size-14 text-on-night-2" strokeWidth={1.2} />
        <span className="absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-pricier shadow-[0_0_10px_var(--pricier)] motion-safe:animate-[focus-pulse_0.9s_ease-in-out_infinite_alternate]" />
      </div>
    </div>
  );
}
