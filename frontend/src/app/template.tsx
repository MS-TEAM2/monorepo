"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { transitionDirection } from "@/lib/route-motion";

/** 직전 화면 경로. template은 화면마다 새로 만들어지므로 모듈에 둔다 */
let previousPath: string | null = null;

/**
 * 화면 전환. 흐름에서 앞으로 가면 오른쪽에서, 돌아가면 왼쪽에서 살짝 밀려 들어온다.
 * 움직임이 끝나면 transform을 남기지 않아 아래 고정 버튼·시트(fixed)가 제자리에 붙는다.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const reduce = useReducedMotion();
  const [direction] = useState(() => transitionDirection(previousPath, pathname));
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    previousPath = pathname;
  }, [pathname]);

  if (reduce || settled) return <div className="flex flex-1 flex-col">{children}</div>;
  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={{ opacity: 0, x: direction * 36 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.8 }}
      onAnimationComplete={() => setSettled(true)}
    >
      {children}
    </motion.div>
  );
}
