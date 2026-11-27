/**
 * S11 데이터·한계 안내의 표시 규칙 (스펙 specs/data-ingest R5·R6, Notion 기획서 S11·7·9·11·15장).
 * 수치는 A24 가 주는 실측값만 보여 준다. 모델 지표가 없으면 "검증 전"으로 표시하고 값을 만들지 않는다.
 */
import type { DataStatusItem } from "@/lib/api/data-status";
import { formatQuarter } from "@/lib/area-summary";

type DatasetInfo = { name: string; use: string; cadence: string };

export const DATASET_INFO: Record<string, DatasetInfo> = {
  stores_general: { name: "일반음식점 인허가", use: "지도 매장, 반경 개업·폐업, 생존 기준", cadence: "매일" },
  stores_rest: { name: "휴게음식점 인허가", use: "지도 매장, 반경 개업·폐업, 생존 기준", cadence: "매일" },
  stores_bakery: { name: "제과점 인허가", use: "지도 매장, 반경 개업·폐업, 생존 기준", cadence: "매일" },
  region_population: { name: "길단위인구 (행정동)", use: "상권 요약의 유동인구", cadence: "분기" },
  region_store_stats: { name: "점포 (행정동)", use: "상권 요약의 개업·폐업률, 프랜차이즈 비중", cadence: "분기" },
  region_sales: { name: "추정매출 (행정동)", use: "상권 요약의 점포당 평균 추정매출", cadence: "분기" },
};

export function datasetInfo(dataset: string): DatasetInfo {
  return DATASET_INFO[dataset] ?? { name: dataset, use: "", cadence: "" };
}

export type StatusTone = "ok" | "warn" | "error" | "muted";
export type StatusView = { label: string; tone: StatusTone; detail: string | null };

/** 기준일(인허가) 또는 기준 분기(상권 자료). 성공한 적이 없으면 null */
export function baseLabel(item: DataStatusItem): string | null {
  if (item.base_date) return `기준일 ${item.base_date}`;
  if (item.base_quarter) return `기준 ${formatQuarter(item.base_quarter)}`;
  return null;
}

/**
 * 수집 상태. 실패해도 직전 성공본을 쓰므로(R2) 그 기준을 함께 알린다.
 * 색만으로 구분하지 않도록 글자 라벨을 항상 붙인다.
 */
export function statusView(item: DataStatusItem): StatusView {
  const base = baseLabel(item);
  if (base === null) {
    if (item.last_run_status === "running") return { label: "첫 수집 중", tone: "muted", detail: null };
    if (item.last_run_status === "failed")
      return { label: "수집 실패", tone: "error", detail: "아직 쓸 수 있는 자료가 없어요." };
    return { label: "수집 전", tone: "muted", detail: "아직 수집하지 않아 화면에 쓰지 않아요." };
  }
  if (item.last_run_status === "failed")
    return { label: "최근 수집 실패", tone: "error", detail: `직전 성공본(${base})을 쓰고 있어요.` };
  if (item.stale) return { label: "갱신 지연", tone: "warn", detail: `${base} 이후 새 자료를 받지 못했어요.` };
  if (item.last_run_status === "running") return { label: "갱신 중", tone: "ok", detail: null };
  return { label: "정상", tone: "ok", detail: null };
}

/** 좌표가 없어 지도와 반경 집계에서 뺀 매장 수 (기획서 S02). 매장 자료가 아니면 null */
export function missingLocationLabel(item: DataStatusItem): string | null {
  if (item.missing_location_count === null) return null;
  return `좌표 없음 ${item.missing_location_count.toLocaleString("ko-KR")}곳 (지도·반경 집계에서 제외)`;
}

/** 손익·예상 손실 산식 (기획서 7장). 화면에 그대로 보여 준다 */
export const FORMULAS: readonly { title: string; lines: readonly string[] }[] = [
  {
    title: "손익",
    lines: [
      "월 고정비 = 월세 + 관리비 + 인건비 + 기타 고정비",
      "손익분기 매출 = 월 고정비 ÷ (1 − 변동비율)",
      "예상 월손익 = 예상 월매출 × (1 − 변동비율) − 월 고정비",
      "감당 가능한 월세 = 예상 월매출 × (1 − 변동비율) − (관리비 + 인건비 + 기타 고정비)",
    ],
  },
  {
    title: "중도 종료 시 예상 손실",
    lines: [
      "예상 손실 = 권리금 + 시설비 + 종료 시점까지의 누적 영업손실 + 종료 후 부담할 월세·관리비 + 위약금 + 원상복구비",
      "보증금은 돌려받는다고 보고 뺐어요. 돌려받지 못하면 손실이 더 커질 수 있어요.",
    ],
  },
  {
    title: "생존확률",
    lines: [
      "개업 후 12·24·36개월의 영업 지속 확률이에요. 24·36개월은 서울 업종별 기준선(Kaplan-Meier)이에요.",
      "12개월은 검증을 통과한 모델이 있을 때만 모델을 쓰고, 아니면 업종 기준선을 써요.",
    ],
  },
];

/** 한계 (기획서 9·15·17·18장) */
export const LIMITATIONS: readonly string[] = [
  "생존확률은 같은 조건의 과거 매장 통계예요. 특정 점포의 확정 예측이 아니고, 요인은 인과관계가 아니에요.",
  "인허가의 폐업에는 이전·명의 변경도 섞일 수 있어요.",
  "업종은 인허가 업태로 나눠요. '기타' 등 맞지 않는 업태는 지도·집계에서 빠져요.",
  "유동인구는 행정동 추정값이에요. 매장 앞 통행량이 아니에요.",
  "점포당 추정매출은 특정 매장 매출이 아니에요. 매출 단위를 확인하기 전에는 표시하지 않아요.",
  "상권 자료는 분기 단위라 공개까지 2–3개월 늦어요.",
  "계약서 검토는 법률 자문이 아닌 검토 보조예요.",
];

/** 개인정보 처리 (기획서 11장, specs/social-login R6) */
export const PRIVACY_NOTES: readonly string[] = [
  "로그인은 구글·카카오 식별값만 저장해요. 이메일·이름·사진과 공급자 토큰은 저장하지 않아요.",
  "진단·계약 자료는 생성 후 30일 보관하고, 내 계정에서만 볼 수 있어요.",
  "계약서 원본과 글자 인식 보관분은 분석이 끝나거나 실패·취소되면 지워요.",
  "계약서 내용, 정확한 좌표, 주소·상호 검색어, 로그인 토큰은 로그에 남기지 않아요.",
  "매장의 전화번호와 대표자 정보는 저장하지 않아요.",
];
