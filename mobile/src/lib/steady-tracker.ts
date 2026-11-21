/**
 * 자이로 센서 값으로 "카메라를 가만히 들고 있는지" 판단한다. React Native 에 의존하지 않는다 (vitest).
 *
 * - 회전 속도(rad/s)를 부드럽게 만든 값이 threshold 아래면 멈춘 것으로 본다.
 * - 멈춘 상태가 holdMs 동안 이어지면 done. 중간에 움직이면 처음부터 다시 센다.
 * - 화면을 연 직후 warmupMs 동안은 세지 않는다 (카메라를 켜자마자 찍히지 않게).
 */

export type SteadyPhase = "warming" | "moving" | "steady" | "done";

export type SteadyState = {
  phase: SteadyPhase;
  /** 0~1, 멈춘 채로 holdMs 를 얼마나 채웠는지 */
  progress: number;
  /** 이번에 움직여서 세던 것이 초기화됐는지 (안내 문구용) */
  interrupted: boolean;
};

export type SteadyOptions = { threshold?: number; holdMs?: number; warmupMs?: number; smoothing?: number };

export function createSteadyTracker(startAt: number, options: SteadyOptions = {}) {
  const threshold = options.threshold ?? 0.22;
  const holdMs = options.holdMs ?? 3000;
  const warmupMs = options.warmupMs ?? 700;
  const smoothing = options.smoothing ?? 0.35;

  let level = 0;
  let steadySince: number | null = null;
  let wasCounting = false;
  let finished = false;

  return {
    /**
     * 센서 값 하나를 넣고 지금 상태를 받는다. 센서가 없는 기기는 0 을 넣으면 시간만으로 판단한다.
     * blocked 면(예: 화면에 상품이 안 보임) 멈춰 있어도 세지 않고 처음부터 다시 센다. 움직임 안내는 띄우지 않는다.
     */
    update(rotation: { x: number; y: number; z: number }, now: number, blocked = false): SteadyState {
      if (finished) return { phase: "done", progress: 1, interrupted: false };
      const magnitude = Math.hypot(rotation.x, rotation.y, rotation.z);
      level = level + (magnitude - level) * smoothing;

      if (now - startAt < warmupMs) return { phase: "warming", progress: 0, interrupted: false };

      if (blocked) {
        steadySince = null;
        wasCounting = false;
        return { phase: "moving", progress: 0, interrupted: false };
      }

      if (level >= threshold) {
        const interrupted = wasCounting;
        steadySince = null;
        wasCounting = false;
        return { phase: "moving", progress: 0, interrupted };
      }

      steadySince ??= now;
      wasCounting = true;
      const progress = Math.min(1, (now - steadySince) / holdMs);
      if (progress >= 1) {
        finished = true;
        return { phase: "done", progress: 1, interrupted: false };
      }
      return { phase: "steady", progress, interrupted: false };
    },
  };
}
