import type { ContractCondition, ContractConditionId, ContractRisk } from "./types";

/** 이 값은 화면 흐름 확인을 위해 만든 가상 계약서 예시이며 실제 분석 결과가 아닙니다. */
export const sampleConditions: ContractCondition[] = [
  {
    id: "deposit",
    label: "보증금",
    description: "계약 체결 시 맡기는 금액",
    value: "5000",
    confidence: 0.97,
    evidence: "보증금 금 오천만원정(₩50,000,000)",
    unit: "만원",
    inputKind: "number",
  },
  {
    id: "rent",
    label: "월세 (차임)",
    description: "매월 납부하는 임대료",
    value: "300",
    confidence: 0.95,
    evidence: "차임 월 금 삼백만원정(₩3,000,000), 부가가치세 별도",
    unit: "만원",
    inputKind: "number",
  },
  {
    id: "maintenance",
    label: "월 관리비",
    description: "월세와 별도로 납부하는 비용",
    value: "",
    confidence: 0.58,
    evidence: "관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다",
    unit: "만원",
    inputKind: "number",
  },
  {
    id: "vat",
    label: "월세 부가세",
    description: "월세에 부가가치세가 포함되는지 확인해 주세요",
    value: "별도",
    confidence: 0.93,
    evidence: "차임에 대한 부가가치세는 임차인이 별도 부담한다",
    inputKind: "vat",
  },
  {
    id: "term",
    label: "계약 기간",
    description: "임대차 계약 기간",
    value: "24",
    confidence: 0.96,
    evidence: "임대차 기간은 인도일로부터 24개월로 한다",
    unit: "개월",
    inputKind: "number",
  },
  {
    id: "increaseRate",
    label: "연 월세 인상률",
    description: "계약 갱신 시 월세 조정 조건",
    value: "7",
    confidence: 0.9,
    evidence: "임차인은 매년 차임을 7% 인상하는 데 동의한다",
    unit: "%",
    inputKind: "number",
  },
  {
    id: "earlyTermination",
    label: "중도 해지 위약금",
    description: "계약 기간 중 종료할 때의 조건과 비용",
    value: "잔여 기간 차임 전액",
    confidence: 0.88,
    evidence: "임차인 사정으로 해지 시 잔여 기간 차임 전액을 위약금으로 지급한다",
    inputKind: "text",
  },
  {
    id: "restoration",
    label: "원상복구 범위",
    description: "계약 종료 시 복구해야 하는 범위",
    value: "",
    confidence: 0.41,
    evidence: "임차인은 퇴거 시 공실 상태로 원상복구한다 (금액 미기재)",
    inputKind: "text",
  },
];

export const sampleContractText = `상가건물 임대차계약서 · 시연용 예시

제1조 (임대차 기간)
임대차 기간은 인도일로부터 24개월로 한다.

제2조 (보증금)
보증금 금 오천만원정(₩50,000,000)

제3조 (차임 및 부가가치세)
차임 월 금 삼백만원정(₩3,000,000), 부가가치세 별도

제4조 (관리비)
관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다.

제5조 (중도 해지)
임차인 사정으로 해지 시 잔여 기간 차임 전액을 위약금으로 지급한다.

제6조 (차임 조정)
임차인은 매년 차임을 7% 인상하는 데 동의한다.

제7조 (목적물의 반환)
임차인은 퇴거 시 공실 상태로 원상복구한다.

※ 개인정보가 없는 화면 시연용 가상 문서입니다.`;

export const sampleRisks: ContractRisk[] = [
  {
    id: "R01",
    title: "중도 해지 위약금 조건 확인",
    source: "임차인 사정으로 해지 시 잔여 기간 차임 전액을 위약금으로 지급한다",
    reviewPoint: "중도 해지 시 부담 범위와 새 임차인을 구한 경우의 처리 조건을 확인하세요.",
    question: "새 임차인을 구하면 위약금 조건이 달라지는지 계약서에 구체적으로 적을 수 있나요?",
  },
  {
    id: "R02",
    title: "원상복구 기준 구체화",
    source: "임차인은 퇴거 시 공실 상태로 원상복구한다.",
    reviewPoint: "입점 전부터 있던 시설까지 복구 대상인지, 현재 상태를 기록할 수 있는지 확인하세요.",
    question: "원상복구 기준을 입점 당시 상태로 정하고 현황 사진을 첨부할 수 있나요?",
  },
  {
    id: "R03",
    title: "차임 인상 조건 확인",
    source: "임차인은 매년 차임을 7% 인상하는 데 동의한다.",
    reviewPoint: "인상 시점과 계산 기준, 변경 협의 절차를 확인하세요.",
    question: "매년 인상 조건의 적용 시점과 계산 기준을 계약서에 명확히 적을 수 있나요?",
  },
  {
    id: "R04",
    title: "관리비 조정 조건 확인",
    source: "관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다.",
    reviewPoint: "관리비 금액이 불명확하고 조정 조건이 구체적으로 적혀 있지 않습니다.",
    question: "관리비 항목과 조정 기준, 변경 전 안내 절차를 계약서에 적을 수 있나요?",
  },
];

export const emptyConfirmationState: Record<ContractConditionId, boolean> = {
  deposit: false,
  rent: false,
  maintenance: false,
  vat: false,
  term: false,
  increaseRate: false,
  earlyTermination: false,
  restoration: false,
};

export const initialSampleValues: Record<ContractConditionId, string> = {
  deposit: "5000",
  rent: "300",
  maintenance: "",
  vat: "별도",
  term: "24",
  increaseRate: "7",
  earlyTermination: "잔여 기간 차임 전액",
  restoration: "",
};
