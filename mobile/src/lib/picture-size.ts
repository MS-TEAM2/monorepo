/**
 * 카메라가 지원하는 사진 크기 중 매칭에 충분하면서 가장 작은 것을 고른다.
 * 웹뷰로 base64 를 넘기므로 원본(12MP)은 너무 크다. 긴 변 기준 target 이상 중 가장 작은 것, 없으면 가장 큰 것.
 * iOS 는 "Photo", "High", "Medium" 같은 프리셋 이름을 주므로 숫자 크기가 없으면 "Medium" 을 쓴다.
 */
export function pickPictureSize(available: readonly string[], target = 1024): string | undefined {
  const sized = available
    .map((name) => {
      const match = /^(\d+)x(\d+)$/.exec(name);
      return match ? { name, long: Math.max(Number(match[1]), Number(match[2])) } : null;
    })
    .filter((size): size is { name: string; long: number } => size !== null)
    .sort((a, b) => a.long - b.long);

  if (sized.length > 0) return (sized.find((size) => size.long >= target) ?? sized[sized.length - 1]).name;
  return available.includes("Medium") ? "Medium" : undefined;
}
