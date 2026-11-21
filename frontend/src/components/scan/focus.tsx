import type { Box } from "@/lib/prototype/image-analysis";
import { cn } from "@/lib/utils";

/**
 * 인식한 상품만 또렷하게: 사진 전체를 흐리고 어둡게 덮은 뒤, 상품 영역만 원본을 다시 잘라 올린다.
 * 분석 중 화면과 결과 화면 맨 위에서 같은 모습으로 이어진다. 부모는 사진 크기와 같은 relative 상자여야 한다.
 */
export function Spotlight({
  src,
  box,
  label,
  animate = true,
}: {
  src: string;
  box: Box;
  label?: string;
  animate?: boolean;
}) {
  const inset = `${box.y * 100}% ${(1 - box.x - box.width) * 100}% ${(1 - box.y - box.height) * 100}% ${box.x * 100}% round 10px`;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className={cn(
          "absolute inset-0 size-full scale-105 object-cover blur-md brightness-[0.5]",
          animate && "motion-safe:animate-[blur-in_0.6s_ease-out_both]",
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(${inset})` }}
      />
      <FocusBox box={box} label={label} animate={animate} />
    </>
  );
}

const CORNERS = {
  thin: [
    "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-lg",
    "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-lg",
    "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-lg",
    "right-0 bottom-0 border-r-[3px] border-b-[3px] rounded-br-lg",
  ],
  thick: [
    "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
    "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
    "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
    "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl",
  ],
};

/** 노란 초점 모서리. 렌즈의 뷰파인더, 분석 중, 결과 사진에서 같은 모양을 쓴다 */
export function Corners({ size = "size-5", weight = "thin" }: { size?: string; weight?: keyof typeof CORNERS }) {
  return (
    <>
      {CORNERS[weight].map((corner) => (
        <span key={corner} aria-hidden className={cn("absolute border-unit", size, corner)} />
      ))}
    </>
  );
}

/** 사진 속 상품 위치에 초점 네모가 맺힌다 (카메라 앱의 초점 표시처럼) */
function FocusBox({ box, label, animate }: { box: Box; label?: string; animate: boolean }) {
  return (
    <div
      aria-hidden
      className={cn("absolute", animate && "motion-safe:animate-[focus-in_0.5s_ease-out_both]")}
      style={{
        left: `${box.x * 100}%`,
        top: `${box.y * 100}%`,
        width: `${box.width * 100}%`,
        height: `${box.height * 100}%`,
      }}
    >
      {animate ? (
        <div className="absolute inset-0 rounded-lg bg-unit/10 motion-safe:animate-[focus-pulse_0.9s_ease-in-out_0.5s_infinite_alternate]" />
      ) : null}
      <Corners />
      {label ? (
        <span className="absolute -top-8 left-0 rounded-full bg-unit px-2.5 py-1 text-[12px] font-bold whitespace-nowrap text-ink">
          {label}
        </span>
      ) : null}
    </div>
  );
}
