/**
 * 카메라 프레임의 밝기(Y) 값으로 "화면 속 상품"의 위치를 실시간으로 잡는다.
 * VisionCamera 프레임 처리기(워클릿)에서 매 프레임 부르므로 가볍게, 클로저 없이 쓴다.
 * React Native 에 의존하지 않는다 (vitest).
 *
 * - 밝기: 평균이 너무 낮으면 "dark"
 * - 상품 위치: 배경(테두리)과 밝기가 다르고 윤곽이 많은 곳, 화면 가운데일수록 가중치를 더 준다
 * - 윤곽이 거의 없으면(벽·바닥만 보임) "empty"
 *
 * 상품이 "무엇인지"는 여기서 알 수 없다. 이름 인식은 찍은 사진으로 서버(지금은 웹의 더미)가 한다.
 */

export type SubjectBox = { x: number; y: number; width: number; height: number };

const WHOLE: SubjectBox = { x: 0, y: 0, width: 1, height: 1 };

export type SubjectCheck = {
  verdict: "ok" | "dark" | "empty";
  /** 0~255 평균 밝기 */
  brightness: number;
  /** 윤곽이 뚜렷한 칸의 비율 0~1 */
  detail: number;
  /** 0~1 비율 좌표(프레임 기준). 상품을 못 잡으면 null */
  box: SubjectBox | null;
};

export const SUBJECT_LIMITS = {
  darkBrightness: 40,
  minDetail: 0.03,
  edge: 26,
  /** 가로 칸 수. 세로는 프레임 비율로 정한다 */
  grid: 48,
} as const;

/**
 * @param luma 밝기 값 배열 (YUV 의 Y 평면, 또는 회색조)
 * @param rowStride 한 줄의 바이트 수 (패딩이 있으면 width 보다 크다)
 * @param region 살펴볼 영역(0~1). 사용자가 상품을 맞추는 네모 근처만 보면 주변 물건에 덜 흔들린다. 결과 box 는 프레임 전체 기준이다
 */
export function detectSubject(
  luma: Uint8Array,
  width: number,
  height: number,
  rowStride: number,
  region: SubjectBox = WHOLE,
): SubjectCheck {
  "worklet";
  const rx = Math.max(0, Math.floor(region.x * width));
  const ry = Math.max(0, Math.floor(region.y * height));
  const rw = Math.max(8, Math.min(width - rx, Math.round(region.width * width)));
  const rh = Math.max(8, Math.min(height - ry, Math.round(region.height * height)));
  const gw = SUBJECT_LIMITS.grid;
  const gh = Math.max(8, Math.round((gw * rh) / rw));
  const count = gw * gh;
  const cells = new Float32Array(count);

  let sum = 0;
  for (let gy = 0; gy < gh; gy++) {
    const py = Math.min(height - 1, ry + Math.floor(((gy + 0.5) * rh) / gh));
    for (let gx = 0; gx < gw; gx++) {
      const px = Math.min(width - 1, rx + Math.floor(((gx + 0.5) * rw) / gw));
      const value = luma[py * rowStride + px];
      cells[gy * gw + gx] = value;
      sum += value;
    }
  }
  const brightness = sum / count;

  let border = 0;
  for (let gx = 0; gx < gw; gx++) border += cells[gx] + cells[(gh - 1) * gw + gx];
  for (let gy = 1; gy < gh - 1; gy++) border += cells[gy * gw] + cells[gy * gw + gw - 1];
  const background = border / (2 * gw + 2 * (gh - 2));

  const score = new Float32Array(count);
  let edges = 0;
  let scoreSum = 0;
  let scoreSq = 0;
  for (let gy = 1; gy < gh - 1; gy++) {
    for (let gx = 1; gx < gw - 1; gx++) {
      const i = gy * gw + gx;
      const gradient = Math.abs(cells[i + 1] - cells[i - 1]) + Math.abs(cells[i + gw] - cells[i - gw]);
      if (gradient > SUBJECT_LIMITS.edge) edges++;
      // 가운데일수록 1, 가장자리는 0.45. 사용자는 상품을 네모(가운데)에 맞춘다
      const dx = (gx + 0.5) / gw - 0.5;
      const dy = (gy + 0.5) / gh - 0.5;
      const prior = 1 - 0.55 * Math.min(1, (dx * dx + dy * dy) * 4);
      const value = (gradient + 0.5 * Math.abs(cells[i] - background)) * prior;
      score[i] = value;
      scoreSum += value;
      scoreSq += value * value;
    }
  }
  const detail = edges / ((gw - 2) * (gh - 2));

  if (brightness < SUBJECT_LIMITS.darkBrightness) return { verdict: "dark", brightness, detail, box: null };
  if (detail < SUBJECT_LIMITS.minDetail) return { verdict: "empty", brightness, detail, box: null };

  const mean = scoreSum / count;
  const std = Math.sqrt(Math.max(0, scoreSq / count - mean * mean));
  const threshold = mean + std * 0.5;

  // 점수가 높은 칸이 가로·세로로 어디에 몰렸는지 세어 10~90% 범위를 고른다
  const cols = new Float32Array(gw);
  const rows = new Float32Array(gh);
  let hits = 0;
  for (let i = 0; i < count; i++) {
    if (score[i] > threshold) {
      cols[i % gw]++;
      rows[Math.floor(i / gw)]++;
      hits++;
    }
  }
  if (hits < 6) return { verdict: "empty", brightness, detail, box: null };

  let left = 0;
  let right = gw - 1;
  let top = 0;
  let bottom = gh - 1;
  let acc = 0;
  for (let gx = 0; gx < gw; gx++) {
    acc += cols[gx];
    if (acc >= hits * 0.1) {
      left = gx;
      break;
    }
  }
  acc = 0;
  for (let gx = gw - 1; gx >= 0; gx--) {
    acc += cols[gx];
    if (acc >= hits * 0.1) {
      right = gx;
      break;
    }
  }
  acc = 0;
  for (let gy = 0; gy < gh; gy++) {
    acc += rows[gy];
    if (acc >= hits * 0.1) {
      top = gy;
      break;
    }
  }
  acc = 0;
  for (let gy = gh - 1; gy >= 0; gy--) {
    acc += rows[gy];
    if (acc >= hits * 0.1) {
      bottom = gy;
      break;
    }
  }

  const pad = 0.03;
  const x0 = Math.max(0, left / gw - pad);
  const y0 = Math.max(0, top / gh - pad);
  const x1 = Math.min(1, (right + 1) / gw + pad);
  const y1 = Math.min(1, (bottom + 1) / gh + pad);
  if ((x1 - x0) * (y1 - y0) < 0.03) return { verdict: "empty", brightness, detail, box: null };
  // 영역 안 좌표 → 프레임 전체 좌표
  const sx = rw / width;
  const sy = rh / height;
  return {
    verdict: "ok",
    brightness,
    detail,
    box: { x: rx / width + x0 * sx, y: ry / height + y0 * sy, width: (x1 - x0) * sx, height: (y1 - y0) * sy },
  };
}
