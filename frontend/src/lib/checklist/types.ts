/**
 * 창업 가이드 필수사항 체크리스트(M8)의 항목 형식.
 * 스펙: specs/opening-checklist/spec.md (R1·R3·R4·R6)
 */

/** 시기 (R1) */
export const CHECKLIST_PHASES = ["계약 전", "영업신고 전", "개업 전후"] as const;
export type ChecklistPhase = (typeof CHECKLIST_PHASES)[number];

/** 구분 (R3) */
export const CHECKLIST_TAGS = ["법적 의무", "조건부", "권장"] as const;
export type ChecklistTagName = (typeof CHECKLIST_TAGS)[number];

/** 영업신고 종류 (R1). 기획서 S12의 세 가지만 받는다. */
export const REPORT_TYPES = ["일반음식점", "휴게음식점", "제과점"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

/** 사용자가 고르는 조건. 조건부 항목은 이 키로 걸러 낸다. */
export const CHECKLIST_CONDITION_KEYS = ["franchise", "staff", "big", "lpg", "delivery", "alcohol"] as const;
export type ChecklistConditionKey = (typeof CHECKLIST_CONDITION_KEYS)[number];

/** 화면 안에서 이동할 곳 */
export const CHECKLIST_ACTIONS = ["map", "contract"] as const;
export type ChecklistAction = (typeof CHECKLIST_ACTIONS)[number];

export type ChecklistEntry = {
  /** 영문 소문자·숫자·하이픈. 완료 표시 저장(SCRUM-166)의 키가 되므로 바꾸지 않는다. */
  id: string;
  phase: ChecklistPhase;
  title: string;
  description: string;
  /** 구분 */
  tag: ChecklistTagName;
  /** 이 항목이 적용되는 신고 종류. 1개 이상 */
  reportTypes: ReportType[];
  /** 적용 조건. 모두에게 해당하면 text에 "모든 영업자"처럼 적는다. 조건부 항목은 keys가 1개 이상이어야 한다. */
  condition: { text: string; keys?: ChecklistConditionKey[] };
  /** 공식 출처 (법령·고시·기관 안내) */
  source: { name: string; url: string };
  /** 출처를 확인한 날 (YYYY-MM-DD) */
  checkedAt: string;
  /** 공식 원문과 대조했는지 (R4). 대조하지 않은 항목은 공개하지 않는다. */
  verified: boolean;
  /** 면적·층·지역에 따라 달라 관할 기관 확인을 안내할지 (R6) */
  jurisdictionCheck?: boolean;
  /** 담당 기관 바로가기 */
  link?: { label: string; url: string };
  /** 화면 안 이동 */
  action?: ChecklistAction;
};
