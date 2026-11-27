"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { transitionDirection } from "@/lib/route-motion";

/** 직전 화면 경로. template은 화면마다 새로 만들어지므로 모듈에 둔다 */
let previousPath: string | null = null;

/**
 * 화면 전환. 흐름에서 앞으로 가면 오른쪽에서, 돌아가면 왼쪽에서 살짝 밀려 들어온다.
 * 처음 열 때나 방향을 모를 때는 움직이지 않는다. 화면 안의 등장 연출과 겹쳐 두 번 움직이는 것처럼 보이기 때문이다.
 *
 * 감싸는 요소는 끝까지 같은 motion.div로 둔다. 움직임이 끝난 뒤 div로 바꾸면 React가 화면 전체를 새로 만들어
 * 안쪽 등장 연출이 한 번 더 재생된다. x가 0으로 끝나면 motion이 transform을 none으로 돌려놓으므로
 * 아래 고정 버튼·시트(fixed)도 제자리에 붙는다.
 */
export default function Template({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const reduce = useReducedMotion();
  const [direction] = useState(() => transitionDirection(previousPath, pathname));

  useEffect(() => {
    previousPath = pathname;
  }, [pathname]);

  const animate = !reduce && direction !== 0;

  return (
    <motion.div
      className="flex flex-1 flex-col"
      initial={animate ? { opacity: 0, x: direction * 24 } : false}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
