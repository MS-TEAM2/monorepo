import type { SubjectBox, SubjectCheck } from "./subject-detector";

/**
 * 프레임마다 흔들리는 상품 위치를 부드럽게 이어 주고, "상품을 잡았다"를 판단한다.
 * React Native 에 의존하지 않는다 (vitest).
 *
 * - present: 상품이 holdMs 이상 이어서 보이면 true (한두 프레임 놓쳐도 graceMs 동안은 유지)
 * - dark: 어두운 프레임이 darkMs 이상 이어지면 true
 */

export type SubjectState = {
  present: boolean;
  dark: boolean;
  /** 부드럽게 만든 상품 위치. 놓쳤으면 null */
  box: SubjectBox | null;
};

export type SubjectTrackerOptions = { smoothing?: number; holdMs?: number; graceMs?: number; darkMs?: number };

export function createSubjectTracker(options: SubjectTrackerOptions = {}) {
  const smoothing = options.smoothing ?? 0.45;
  const holdMs = options.holdMs ?? 350;
  const graceMs = options.graceMs ?? 500;
  const darkMs = options.darkMs ?? 900;

  let box: SubjectBox | null = null;
  let seenSince: number | null = null;
  let lastSeen = -Infinity;
  let darkSince: number | null = null;

  return {
    update(check: SubjectCheck, now: number): SubjectState {
      darkSince = check.verdict === "dark" ? (darkSince ?? now) : null;
      const dark = darkSince !== null && now - darkSince >= darkMs;

      if (check.verdict === "ok" && check.box) {
        box = box ? blend(box, check.box, smoothing) : check.box;
        seenSince ??= now;
        lastSeen = now;
      } else if (now - lastSeen > graceMs) {
        box = null;
        seenSince = null;
      }

      const present = box !== null && seenSince !== null && now - seenSince >= holdMs;
      return { present, dark, box };
    },
  };
}

function blend(from: SubjectBox, to: SubjectBox, t: number): SubjectBox {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

/** 프레임 좌표(0~1)를 화면을 꽉 채운(cover) 미리보기 위의 좌표(px)로 바꾼다 */
export function frameBoxToView(
  box: SubjectBox,
  frame: { width: number; height: number },
  view: { width: number; height: number },
): SubjectBox {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const shownWidth = frame.width * scale;
  const shownHeight = frame.height * scale;
  const offsetX = (view.width - shownWidth) / 2;
  const offsetY = (view.height - shownHeight) / 2;
  return {
    x: offsetX + box.x * shownWidth,
    y: offsetY + box.y * shownHeight,
    width: box.width * shownWidth,
    height: box.height * shownHeight,
  };
}

/** frameBoxToView 의 반대: 화면 위 네모(px)를 프레임 좌표(0~1)로. 벗어난 부분은 잘라 낸다 */
export function viewBoxToFrame(
  box: SubjectBox,
  frame: { width: number; height: number },
  view: { width: number; height: number },
): SubjectBox {
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const shownWidth = frame.width * scale;
  const shownHeight = frame.height * scale;
  const offsetX = (view.width - shownWidth) / 2;
  const offsetY = (view.height - shownHeight) / 2;
  const x0 = Math.max(0, (box.x - offsetX) / shownWidth);
  const y0 = Math.max(0, (box.y - offsetY) / shownHeight);
  const x1 = Math.min(1, (box.x + box.width - offsetX) / shownWidth);
  const y1 = Math.min(1, (box.y + box.height - offsetY) / shownHeight);
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}
