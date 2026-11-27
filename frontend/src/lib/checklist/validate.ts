import {
  CHECKLIST_ACTIONS,
  CHECKLIST_CONDITION_KEYS,
  CHECKLIST_PHASES,
  CHECKLIST_TAGS,
  REPORT_TYPES,
  type ChecklistEntry,
} from "@/lib/checklist/types";

export type ChecklistValidation = { items: ChecklistEntry[]; errors: string[] };

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function includes<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** YYYY-MM-DD이고 실제 있는 날짜인지 */
function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 날짜를 YYYY-MM-DD로 (한국 시간 기준) */
export function toDateString(date: Date): string {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 항목 하나를 검사해 오류 문장을 돌려준다. */
function checkEntry(raw: unknown, label: string, today: string): string[] {
  if (!isRecord(raw)) return [`${label}: 항목이 객체가 아니에요`];
  const errors: string[] = [];
  const at = isNonEmptyString(raw.id) ? raw.id : label;
  const fail = (message: string) => errors.push(`${at}: ${message}`);

  if (!isNonEmptyString(raw.id)) fail("id가 없어요");
  else if (!ID_PATTERN.test(raw.id)) fail("id는 영문 소문자·숫자·하이픈만 써요");

  if (!includes(CHECKLIST_PHASES, raw.phase)) fail(`시기는 ${CHECKLIST_PHASES.join("·")} 중 하나여야 해요`);
  if (!isNonEmptyString(raw.title)) fail("제목이 없어요");
  if (!isNonEmptyString(raw.description)) fail("설명이 없어요");

  if (raw.tag === undefined || raw.tag === "") fail("구분이 없어요");
  else if (!includes(CHECKLIST_TAGS, raw.tag)) fail(`구분은 ${CHECKLIST_TAGS.join("·")} 중 하나여야 해요`);

  if (!Array.isArray(raw.reportTypes) || raw.reportTypes.length === 0) fail("적용 신고 종류가 없어요");
  else if (!raw.reportTypes.every((type) => includes(REPORT_TYPES, type)))
    fail(`신고 종류는 ${REPORT_TYPES.join("·")}만 쓸 수 있어요`);

  const condition = raw.condition;
  if (!isRecord(condition) || !isNonEmptyString(condition.text)) fail("적용 조건이 없어요");
  if (isRecord(condition) && condition.keys !== undefined) {
    if (!Array.isArray(condition.keys) || !condition.keys.every((key) => includes(CHECKLIST_CONDITION_KEYS, key)))
      fail(`조건 키는 ${CHECKLIST_CONDITION_KEYS.join("·")}만 쓸 수 있어요`);
  }
  if (raw.tag === "조건부") {
    const keys = isRecord(condition) && Array.isArray(condition.keys) ? condition.keys : [];
    if (keys.length === 0) fail("조건부 항목은 조건 키가 1개 이상 있어야 해요");
  }

  const source = raw.source;
  if (!isRecord(source) || !isNonEmptyString(source.name)) fail("출처가 없어요");
  else if (!isHttpsUrl(source.url)) fail("출처 주소는 https로 시작해야 해요");

  if (!isNonEmptyString(raw.checkedAt)) fail("확인일이 없어요");
  else if (!isValidDate(raw.checkedAt)) fail("확인일은 YYYY-MM-DD 형식의 실제 날짜여야 해요");
  else if (raw.checkedAt > today) fail("확인일이 오늘보다 뒤예요");

  if (typeof raw.verified !== "boolean") fail("원문 대조 여부(verified)는 true 또는 false여야 해요");
  if (raw.jurisdictionCheck !== undefined && typeof raw.jurisdictionCheck !== "boolean")
    fail("관할 기관 확인 안내(jurisdictionCheck)는 true 또는 false여야 해요");

  if (raw.link !== undefined) {
    if (!isRecord(raw.link) || !isNonEmptyString(raw.link.label) || !isHttpsUrl(raw.link.url))
      fail("바로가기는 이름과 https 주소가 있어야 해요");
  }
  if (raw.action !== undefined && !includes(CHECKLIST_ACTIONS, raw.action))
    fail(`화면 이동은 ${CHECKLIST_ACTIONS.join("·")}만 쓸 수 있어요`);

  return errors;
}

/**
 * 체크리스트 파일을 검사한다. 오류가 하나도 없을 때만 items에 항목이 담긴다.
 * 구분·조건·출처·확인일이 빠지면 오류가 난다 (SCRUM-163 완료 조건).
 */
export function validateChecklist(raw: unknown, { today = toDateString(new Date()) } = {}): ChecklistValidation {
  if (!Array.isArray(raw)) return { items: [], errors: ["체크리스트는 항목 배열이어야 해요"] };

  const errors = raw.flatMap((entry, index) => checkEntry(entry, `${index + 1}번째 항목`, today));

  const seen = new Set<string>();
  raw.forEach((entry) => {
    if (!isRecord(entry) || !isNonEmptyString(entry.id)) return;
    if (seen.has(entry.id)) errors.push(`${entry.id}: id가 겹쳐요`);
    seen.add(entry.id);
  });

  // 위에서 모든 값을 검사했으므로 오류가 없으면 형식이 맞다
  return errors.length === 0 ? { items: raw as ChecklistEntry[], errors } : { items: [], errors };
}

/** 공개해도 되는 항목 (R4: 공식 원문과 대조한 항목만) */
export function publishedEntries(items: readonly ChecklistEntry[]): ChecklistEntry[] {
  return items.filter((item) => item.verified);
}
