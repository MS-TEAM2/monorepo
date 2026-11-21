/**
 * 찍은 사진의 EXIF 로 장면 밝기를 어림한다. React Native 에 의존하지 않는다 (vitest).
 *
 * Expo Go 에서는 카메라 프레임 픽셀을 읽을 수 없어서, 사진 한 장의 노출값으로 "너무 어두운지"만 본다.
 * - iOS 는 EXIF 에 BrightnessValue(APEX Bv)를 바로 넣어 준다.
 * - 안드로이드는 조리개(FNumber)·셔터(ExposureTime)·감도(ISO)로 Bv = Av + Tv − Sv 를 계산한다.
 */

type Exif = Record<string, unknown> | null | undefined;

/** 이 값보다 어두우면 다시 찍게 한다. 실내 조명 아래는 보통 Bv 1~4, 불 꺼진 방은 −2 이하 */
export const DARK_BV = -1;

/** 주변 밝기 센서(안드로이드)로 미리 안내할 기준. 이 아래가 이어지면 "어두워요" */
export const DARK_LUX = 10;

function numberOf(value: unknown): number | null {
  if (Array.isArray(value)) return numberOf(value[0]);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    // "1/30" 같은 분수 표기
    const [top, bottom] = value.split("/").map(Number);
    if (bottom !== undefined) return bottom ? top / bottom : null;
    return Number.isFinite(top) ? top : null;
  }
  return null;
}

/** 장면 밝기(APEX Bv). 계산할 값이 없으면 null */
export function sceneBrightness(exif: Exif): number | null {
  if (!exif) return null;
  const direct = numberOf(exif.BrightnessValue);
  if (direct !== null) return direct;

  const aperture = numberOf(exif.FNumber);
  const exposure = numberOf(exif.ExposureTime);
  const iso = numberOf(exif.ISOSpeedRatings ?? exif.PhotographicSensitivity);
  if (!aperture || !exposure || !iso || aperture <= 0 || exposure <= 0 || iso <= 0) return null;
  const av = 2 * Math.log2(aperture);
  const tv = -Math.log2(exposure);
  const sv = Math.log2(iso / 3.125);
  return av + tv - sv;
}

/** 밝기를 모르면 어둡다고 하지 않는다 (사진을 막지 않는다) */
export function isTooDark(exif: Exif): boolean {
  const bv = sceneBrightness(exif);
  return bv !== null && bv < DARK_BV;
}
