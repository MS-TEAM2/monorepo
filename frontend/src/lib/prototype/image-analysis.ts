/**
 * 사진 픽셀로 하는 가벼운 사물 인식 흉내. 실제 인식 API 가 생기면 그 응답의 상품 위치(box)로 바꾼다.
 *
 * - 밝기: 평균 밝기가 너무 낮으면 "어두움"
 * - 상품 위치: 테두리(배경)와 색이 다르고 윤곽이 많은 곳을 상품으로 보고 그 범위를 네모로 잡는다
 * - 윤곽이 거의 없으면(벽·바닥만 찍힘) "상품 없음"
 *
 * 브라우저 API 에 의존하지 않는다 (vitest). 캔버스로 픽셀을 꺼내는 일은 image.ts 가 한다.
 */

export type Box = { x: number; y: number; width: number; height: number };

export type ImageCheck = {
  verdict: "ok" | "dark" | "empty";
  /** 0~255 평균 밝기 */
  brightness: number;
  /** 윤곽이 뚜렷한 픽셀의 비율 0~1 */
  detail: number;
  /** 상품이 있을 법한 영역. 0~1 비율 좌표. 상품을 못 찾으면 null */
  box: Box | null;
};

export const IMAGE_LIMITS = {
  /** 평균 밝기가 이보다 낮으면 어둡다 */
  darkBrightness: 38,
  /** 윤곽 픽셀 비율이 이보다 낮으면 상품이 없다고 본다 */
  minDetail: 0.015,
  /** 윤곽으로 볼 밝기 변화량 */
  edge: 28,
} as const;

/** RGBA 픽셀(캔버스 getImageData 형식)을 검사한다. 64~128px 정도로 줄인 이미지를 넣는다 */
export function analyzePixels(rgba: ArrayLike<number>, width: number, height: number): ImageCheck {
  const count = width * height;
  const luma = new Float32Array(count);
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const value = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
    luma[i] = value;
    sum += value;
  }
  const brightness = sum / count;

  // 테두리 한 줄의 평균 밝기를 배경으로 본다
  let border = 0;
  let borderCount = 0;
  for (let x = 0; x < width; x++) {
    border += luma[x] + luma[(height - 1) * width + x];
    borderCount += 2;
  }
  for (let y = 1; y < height - 1; y++) {
    border += luma[y * width] + luma[y * width + width - 1];
    borderCount += 2;
  }
  const background = border / borderCount;

  const score = new Float32Array(count);
  let edges = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gradient = Math.abs(luma[i + 1] - luma[i - 1]) + Math.abs(luma[i + width] - luma[i - width]);
      if (gradient > IMAGE_LIMITS.edge) edges++;
      score[i] = gradient + 0.5 * Math.abs(luma[i] - background);
    }
  }
  const inner = Math.max(1, (width - 2) * (height - 2));
  const detail = edges / inner;

  if (brightness < IMAGE_LIMITS.darkBrightness) return { verdict: "dark", brightness, detail, box: null };
  if (detail < IMAGE_LIMITS.minDetail) return { verdict: "empty", brightness, detail, box: null };
  return { verdict: "ok", brightness, detail, box: subjectBox(score, width, height) };
}

/** 점수가 높은 픽셀들의 10~90% 범위를 상품 영역으로 잡고 조금 넓힌다 */
function subjectBox(score: Float32Array, width: number, height: number): Box {
  let mean = 0;
  for (const value of score) mean += value;
  mean /= score.length;
  let variance = 0;
  for (const value of score) variance += (value - mean) ** 2;
  const threshold = mean + Math.sqrt(variance / score.length) * 0.5;

  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (score[y * width + x] > threshold) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  if (xs.length < 8) return centerBox();
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  const pick = (list: number[], ratio: number) => list[Math.min(list.length - 1, Math.floor(list.length * ratio))];
  const pad = 0.04;
  const left = Math.max(0, pick(xs, 0.1) / width - pad);
  const top = Math.max(0, pick(ys, 0.1) / height - pad);
  const right = Math.min(1, (pick(xs, 0.9) + 1) / width + pad);
  const bottom = Math.min(1, (pick(ys, 0.9) + 1) / height + pad);
  const box = { x: left, y: top, width: right - left, height: bottom - top };
  // 너무 작게 잡히면(점 하나) 가운데를 쓴다
  return box.width * box.height < 0.04 ? centerBox() : box;
}

function centerBox(): Box {
  return { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
}
