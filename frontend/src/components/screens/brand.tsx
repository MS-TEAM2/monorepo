"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * 서비스 캐릭터 "창이"와 브랜드 모티프.
 * 창이는 줄무늬 차양을 쓴 작은 가게다(창업 + 가게 창문). 창문이 얼굴이고, 돋보기로 상권과 계약서를 살핀다.
 * 차양 줄무늬는 외식업 가게의 차양에서 왔고, 화면 위쪽 장식과 로딩 막대에 쓴다.
 */

export type MascotMood = "smile" | "happy" | "worried" | "search";

const INK = "var(--foreground)";

export function Mascot({
  mood = "smile",
  size = 96,
  className,
  animated = true,
  title,
}: {
  mood?: MascotMood;
  size?: number;
  className?: string;
  animated?: boolean;
  title?: string;
}) {
  const reduce = useReducedMotion();
  const live = animated && !reduce;
  const clipId = useId();
  return (
    <motion.svg
      viewBox="0 0 120 124"
      width={size}
      height={(size * 124) / 120}
      className={cn("shrink-0 overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      animate={live ? { y: [0, -3, 0] } : undefined}
      transition={live ? { duration: 2.4, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* 그림자 */}
      <ellipse cx="60" cy="118" rx="30" ry="4" fill={INK} opacity="0.1" />
      {/* 발 */}
      <rect x="38" y="104" width="14" height="10" rx="5" fill={INK} />
      <rect x="68" y="104" width="14" height="10" rx="5" fill={INK} />
      {/* 몸(가게 벽) */}
      <rect x="20" y="38" width="80" height="72" rx="16" fill="var(--mascot-wall)" stroke={INK} strokeWidth="3.5" />
      {/* 창문 얼굴 */}
      <rect x="31" y="56" width="58" height="38" rx="12" fill="var(--mascot-window)" stroke={INK} strokeWidth="3" />
      <path d="M38 62 L46 62" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.9" />
      <Face mood={mood} live={live} />
      {/* 차양 */}
      <defs>
        <clipPath id={clipId}>
          <path d="M12 24 Q12 16 20 16 L100 16 Q108 16 108 24 L108 38 Q101.3 48 94.7 38 Q88 48 81.3 38 Q74.7 48 68 38 Q61.3 48 54.7 38 Q48 48 41.3 38 Q34.7 48 28 38 Q21.3 48 14.7 38 L12 38 Z" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="10" y="14" width="102" height="36" fill="#ffffff" />
        {[0, 2, 4, 6, 8].map((i) => (
          <rect key={i} x={12 + i * 10.7} y="14" width="10.7" height="36" fill="var(--primary)" />
        ))}
      </g>
      <path
        d="M12 24 Q12 16 20 16 L100 16 Q108 16 108 24 L108 38 Q101.3 48 94.7 38 Q88 48 81.3 38 Q74.7 48 68 38 Q61.3 48 54.7 38 Q48 48 41.3 38 Q34.7 48 28 38 Q21.3 48 14.7 38 L12 38 Z"
        fill="none"
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      {mood === "search" && <Magnifier live={live} />}
      {mood === "worried" && <path d="M100 52 q4 6 0 9 q-4 -3 0 -9 Z" fill="#7cc4f0" stroke={INK} strokeWidth="1.5" />}
    </motion.svg>
  );
}

function Face({ mood, live }: { mood: MascotMood; live: boolean }) {
  const happy = mood === "happy";
  const worried = mood === "worried";
  return (
    <g>
      {/* 볼 */}
      <ellipse cx="41" cy="82" rx="5" ry="3" fill="var(--mascot-blush)" />
      <ellipse cx="79" cy="82" rx="5" ry="3" fill="var(--mascot-blush)" />
      {/* 눈 */}
      {happy ? (
        <>
          <path d="M44 74 q5 -7 10 0" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M66 74 q5 -7 10 0" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
        </>
      ) : (
        <motion.g
          style={{ transformBox: "fill-box", transformOrigin: "center" }}
          animate={live ? { scaleY: [1, 1, 0.1, 1, 1] } : undefined}
          transition={live ? { duration: 4, repeat: Infinity, times: [0, 0.9, 0.93, 0.96, 1] } : undefined}
        >
          <ellipse cx="49" cy="73" rx="4" ry="5" fill={INK} />
          <ellipse cx="71" cy="73" rx="4" ry="5" fill={INK} />
          <circle cx="50.3" cy="71.2" r="1.4" fill="#fff" />
          <circle cx="72.3" cy="71.2" r="1.4" fill="#fff" />
        </motion.g>
      )}
      {worried && (
        <>
          <path d="M43 66 l9 -3" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M77 66 l-9 -3" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}
      {/* 입 */}
      {happy ? (
        <path d="M53 81 q7 8 14 0 Z" fill={INK} />
      ) : worried ? (
        <path d="M54 85 q6 -5 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M54 81 q6 5 12 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      )}
    </g>
  );
}

function Magnifier({ live }: { live: boolean }) {
  return (
    <motion.g
      style={{ transformBox: "fill-box", transformOrigin: "20% 80%" }}
      animate={live ? { rotate: [-6, 8, -6] } : undefined}
      transition={live ? { duration: 1.8, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      <path d="M96 92 L110 106" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <circle cx="90" cy="84" r="13" fill="#ffffff" fillOpacity="0.55" stroke={INK} strokeWidth="3.5" />
      <path d="M84 78 q4 -3 8 -1" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
    </motion.g>
  );
}

/** 말풍선. 캐릭터 옆에 짧은 한 문장을 띄운다 */
export function SpeechBubble({
  children,
  side = "left",
  className,
}: {
  children: React.ReactNode;
  side?: "left" | "bottom";
  className?: string;
}) {
  return (
    <motion.div
      className={cn(
        "relative rounded-2xl bg-card px-4 py-2.5 text-[15px] leading-snug font-semibold text-foreground shadow-soft",
        className,
      )}
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 24, delay: 0.25 }}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          "absolute size-3 rotate-45 bg-card",
          side === "left" ? "top-1/2 -left-1.5 -translate-y-1/2" : "-bottom-1.5 left-8",
        )}
      />
    </motion.div>
  );
}

/** 가게 차양 줄무늬 띠. 화면 위쪽 장식에 쓴다 */
export function Awning({ className, scallops = 12 }: { className?: string; scallops?: number }) {
  const width = scallops * 20;
  return (
    <svg
      viewBox={`0 0 ${width} 24`}
      preserveAspectRatio="none"
      className={cn("block h-5 w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <pattern id="awning-stripes" width="20" height="24" patternUnits="userSpaceOnUse">
          <rect width="10" height="24" fill="var(--primary)" />
          <rect x="10" width="10" height="24" fill="#ffffff" />
        </pattern>
      </defs>
      <path d={`M0 0 H${width} V12 ${reverseScallops(scallops)} Z`} fill="url(#awning-stripes)" />
    </svg>
  );
}

function reverseScallops(count: number): string {
  // 오른쪽 끝에서 왼쪽으로 물결 모양 아래 가장자리를 그린다
  const parts: string[] = [];
  for (let i = count; i > 0; i--) parts.push(`Q${i * 20 - 10} 24 ${(i - 1) * 20} 12`);
  return parts.join(" ");
}

/** 차양 줄무늬 진행 막대. 줄무늬가 흐르면서 progress(0–1)만큼 찬다 */
export function AwningProgress({ progress, className }: { progress: number; className?: string }) {
  return (
    <div className={cn("h-3 overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundImage: "repeating-linear-gradient(-45deg, var(--primary) 0 10px, var(--brand-light) 10px 20px)",
          backgroundSize: "28px 28px",
        }}
        initial={{ width: "4%" }}
        animate={{ width: `${Math.max(4, Math.min(100, progress * 100))}%`, backgroundPositionX: ["0px", "28px"] }}
        transition={{
          width: { type: "spring", stiffness: 120, damping: 22 },
          backgroundPositionX: { duration: 0.8, repeat: Infinity, ease: "linear" },
        }}
      />
    </div>
  );
}

/**
 * 분석 로딩. 창이가 돋보기로 지도(진단) 또는 종이(계약서)를 살피고, 단계 문구가 바뀌며 차양 막대가 찬다.
 * step은 지금 단계 번호(0부터). 화면에 맞게 감싸서 쓴다.
 */
export function AnalyzingScene({
  variant,
  steps,
  step,
  image,
}: {
  variant: "diagnosis" | "contract";
  steps: readonly string[];
  step: number;
  /** 계약서 촬영 미리보기(blob·data 주소) */
  image?: string;
}) {
  const reduce = useReducedMotion();
  const current = steps[Math.min(step, steps.length - 1)] ?? "";
  return (
    <div className="flex flex-col items-center" aria-live="polite">
      <div className="relative h-[220px] w-full max-w-[320px]">
        {variant === "diagnosis" ? <MapStage step={step} /> : <PaperStage image={image} />}
        <motion.div
          className="absolute -bottom-3"
          initial={{ left: "8%" }}
          animate={reduce ? { left: "60%" } : { left: ["8%", "58%", "30%", "62%", "8%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Mascot mood="search" size={92} />
        </motion.div>
      </div>
      <div className="mt-8 h-7 overflow-hidden text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={current}
            className="text-[19px] font-bold tracking-tight text-foreground"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.25 }}
          >
            {current}
          </motion.p>
        </AnimatePresence>
      </div>
      <AwningProgress progress={(step + 0.6) / steps.length} className="mt-5 w-full max-w-[280px]" />
    </div>
  );
}

function MapStage({ step }: { step: number }) {
  const pins = [
    [22, 30],
    [62, 22],
    [78, 52],
    [34, 62],
    [52, 44],
    [70, 72],
    [18, 74],
    [86, 30],
  ];
  return (
    <div className="absolute inset-x-4 top-0 bottom-10 overflow-hidden rounded-3xl bg-map-bg shadow-soft">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path d="M0 40 H100 M0 78 H100 M30 0 V100 M72 0 V100" stroke="#ffffff" strokeWidth="5" />
        <path d="M-5 95 Q40 50 105 20" stroke="var(--map-water)" strokeWidth="8" fill="none" />
      </svg>
      <motion.div
        className="absolute top-1/2 left-1/2 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-brand bg-brand-light/15"
        animate={{ scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
      {pins.map(([x, y], index) => (
        <motion.span
          key={`${x}-${y}`}
          className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-light shadow"
          style={{ left: `${x}%`, top: `${y}%` }}
          initial={{ scale: 0, y: -10 }}
          animate={index <= step * 2 + 1 ? { scale: 1, y: 0 } : { scale: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 500, damping: 18, delay: (index % 2) * 0.15 }}
        />
      ))}
    </div>
  );
}

function PaperStage({ image }: { image?: string }) {
  const [lines, setLines] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLines((count) => (count >= 7 ? 0 : count + 1)), 380);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="absolute inset-x-10 top-0 bottom-8 -rotate-2 overflow-hidden rounded-[6px] bg-paper shadow-paper">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- 이 기기에서만 보이는 촬영 미리보기
        <img src={image} alt="찍은 계약서" className="h-full w-full object-cover" />
      ) : (
        <div className="space-y-3 p-5">
          <div className="mx-auto h-2.5 w-2/3 rounded-full bg-paper-ink/70" />
          {[0.92, 0.78, 0.86, 0.64, 0.9, 0.72, 0.84].map((width, index) => (
            <motion.div
              key={index}
              className="h-2 origin-left rounded-full bg-paper-line"
              style={{ width: `${width * 100}%` }}
              animate={{ backgroundColor: index < lines ? "var(--brand-200)" : "var(--paper-line)" }}
              transition={{ duration: 0.25 }}
            />
          ))}
        </div>
      )}
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 h-0.5 bg-primary shadow-[0_0_14px_3px_var(--brand-light)]"
        initial={{ top: "0%" }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
