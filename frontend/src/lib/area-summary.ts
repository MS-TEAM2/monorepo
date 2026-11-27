import type { DongStats } from "@/lib/api/areas";

/** "20262" → "2026년 2분기" */
export function formatQuarter(quarter: string | null | undefined): string {
  if (!quarter || !/^\d{5}$/.test(quarter)) return "기준 분기 없음";
  return `${quarter.slice(0, 4)}년 ${quarter.slice(4)}분기`;
}

export const NO_DATA = "자료 없음";

export function formatCount(value: number | null | undefined, unit = ""): string {
  return value === null || value === undefined ? NO_DATA : `${value.toLocaleString("ko-KR")}${unit}`;
}

/** 0–1 비율 → "4.1%" */
export function formatRate(value: number | null | undefined): string {
  return value === null || value === undefined ? NO_DATA : `${(value * 100).toFixed(1)}%`;
}

export const TIME_SLOT_LABELS: Record<string, string> = {
  "00_06": "0–6시",
  "06_11": "6–11시",
  "11_14": "11–14시",
  "14_17": "14–17시",
  "17_21": "17–21시",
  "21_24": "21–24시",
};

export const AGE_LABELS: Record<string, string> = {
  "10": "10대",
  "20": "20대",
  "30": "30대",
  "40": "40대",
  "50": "50대",
  "60_plus": "60대 이상",
};

/** 막대 그래프용: 정해진 순서대로 [라벨, 값, 최댓값 대비 비율] */
export function distribution(
  values: Record<string, number> | null,
  labels: Record<string, string>,
): { key: string; label: string; value: number; ratio: number }[] {
  if (!values) return [];
  const entries = Object.keys(labels)
    .filter((key) => typeof values[key] === "number")
    .map((key) => ({ key, label: labels[key]!, value: values[key]! }));
  const max = Math.max(1, ...entries.map((entry) => entry.value));
  return entries.map((entry) => ({ ...entry, ratio: entry.value / max }));
}

/** 행정동 값 옆에 붙일 주의 문구 (Notion 기획서 S03, API 명세서 A07) */
export function dongNotes(stats: DongStats): string[] {
  const notes: string[] = [];
  if (stats.relation === "split") notes.push("나뉜 행정동이라 분동 전 통합 값이에요.");
  if (stats.relation === "merged") notes.push(`${stats.source_regions.map((r) => r.name).join("·")} 값을 합쳤어요.`);
  if (stats.population_reference_only)
    notes.push(`유동인구는 ${formatQuarter(stats.population_quarter)} 값을 참고로만 보여 줘요.`);
  return notes;
}
