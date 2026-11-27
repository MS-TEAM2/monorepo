/**
 * 분석기록(S09)의 진단·계약서 검토 기록. 진단·계약서 화면이 아직 예시 계산이라 서버(A09·A15)에 저장하지 않으므로,
 * 로그인한 상태에서 예시 화면을 쓰면 이 브라우저의 localStorage 에 쌓는다.
 * 항목 모양은 A10(GET /diagnoses)·A32(GET /contracts) 응답과 같게 두어 API를 붙일 때 목록만 바꾸면 되게 한다.
 * 보관 기간은 명세와 같은 30일이다. 서버로 보내지 않는다.
 */

import {
  CATEGORIES,
  createContractFields,
  EXAMPLE_FORM,
  INITIAL_FORM,
  INITIAL_PIN,
  NEIGHBORHOODS,
} from "@/lib/mock/startup/data";
import type { AppliedContract, ContractField, FormState } from "@/lib/mock/startup/types";
import type { SessionStorageLike } from "@/lib/session";
import { toSelection, type StartupSelection } from "@/lib/startup-selection";

export const MY_REPORT_STORAGE_KEY = "jcs.myReport.v1";

const RETENTION_DAYS = 30;
const MAX_ITEMS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 진단할 때의 선택값과 입력값 (SCRUM-208). 기록을 누르면 이 값으로 결과를 다시 계산한다.
 * API를 붙이면 진단 상세 조회 응답으로 바꾼다. 예전 기록과 예시 기록에는 없다.
 */
export type DiagnosisSnapshot = { selection: StartupSelection; form: FormState; rentMan: number };

/** 계약서 검토 때의 항목과 손익 반영값, 그때의 진단 입력 */
export type ContractSnapshot = {
  fields: ContractField[];
  applied: AppliedContract;
  diagnosis: DiagnosisSnapshot | null;
};

/** A10 DiagnosisListItem 과 같은 모양. sample 은 화면에 `예시 데이터`로 표시한다 */
export type DiagnosisRecord = {
  id: string;
  address: string;
  category_id: string;
  dong_name: string;
  created_at: string;
  expires_at: string;
  sample?: boolean;
  snapshot?: DiagnosisSnapshot;
};

export type ContractStatus = "processing" | "needs_review" | "confirmed" | "failed";

/** A32 목록 항목과 같은 모양 */
export type ContractRecord = {
  id: string;
  status: ContractStatus;
  diagnosis: { id: string; address: string; category_id: string } | null;
  created_at: string;
  expires_at: string;
  sample?: boolean;
  snapshot?: ContractSnapshot;
};

export type MyReports = { diagnoses: DiagnosisRecord[]; contracts: ContractRecord[] };

type Options = { storage?: SessionStorageLike | null; now?: Date };

const EMPTY: MyReports = { diagnoses: [], contracts: [] };

function defaultStorage(): SessionStorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDiagnosis(value: unknown): value is DiagnosisRecord {
  return (
    isRecord(value) &&
    ["id", "address", "category_id", "dong_name", "created_at", "expires_at"].every(
      (key) => typeof value[key] === "string",
    )
  );
}

function isContract(value: unknown): value is ContractRecord {
  return (
    isRecord(value) &&
    ["id", "status", "created_at", "expires_at"].every((key) => typeof value[key] === "string") &&
    (value.diagnosis === null || isRecord(value.diagnosis))
  );
}

function isFormState(value: unknown): value is FormState {
  return (
    isRecord(value) &&
    (Object.keys(INITIAL_FORM) as (keyof FormState)[]).every((key) => typeof value[key] === typeof INITIAL_FORM[key])
  );
}

export function toDiagnosisSnapshot(value: unknown): DiagnosisSnapshot | null {
  if (!isRecord(value)) return null;
  const selection = toSelection(value.selection);
  const rentMan = value.rentMan;
  if (!selection || !isFormState(value.form) || typeof rentMan !== "number" || !Number.isFinite(rentMan)) return null;
  return { selection, form: value.form, rentMan };
}

function isContractField(value: unknown): value is ContractField {
  return (
    isRecord(value) &&
    typeof value.key === "string" &&
    typeof value.label === "string" &&
    typeof value.numeric === "boolean" &&
    typeof value.ok === "boolean" &&
    typeof value.input === "string"
  );
}

function isApplied(value: unknown): value is AppliedContract {
  return isRecord(value) && Object.values(value).every((v) => typeof v === "string" || typeof v === "number");
}

export function toContractSnapshot(value: unknown): ContractSnapshot | null {
  if (!isRecord(value) || !Array.isArray(value.fields) || !value.fields.every(isContractField)) return null;
  if (!isApplied(value.applied)) return null;
  return {
    fields: value.fields,
    applied: value.applied,
    diagnosis: value.diagnosis === null ? null : toDiagnosisSnapshot(value.diagnosis),
  };
}

/** 저장값의 입력 스냅샷이 틀리면 스냅샷만 버리고 목록 항목은 남긴다 */
function withValidSnapshot<T extends { snapshot?: unknown }>(item: T, check: (value: unknown) => unknown): T {
  if (item.snapshot === undefined) return item;
  const snapshot = check(item.snapshot);
  if (snapshot) return { ...item, snapshot };
  const rest = { ...item };
  delete rest.snapshot;
  return rest;
}

/** 목록 정렬 규칙(API 공통): created_at 내림차순, 같으면 id 내림차순 */
function byNewest(a: { created_at: string; id: string }, b: { created_at: string; id: string }): number {
  if (a.created_at !== b.created_at) return a.created_at < b.created_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/** 저장된 문자열을 읽어 만료된 항목을 빼고 최신순으로 돌려준다. 모양이 다르면 빈 목록 */
export function parseMyReports(raw: string | null, now: Date = new Date()): MyReports {
  if (!raw) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!isRecord(value)) return EMPTY;
  const alive = (item: { expires_at: string }) => Date.parse(item.expires_at) > now.getTime();
  const diagnoses = Array.isArray(value.diagnoses)
    ? value.diagnoses
        .filter(isDiagnosis)
        .filter(alive)
        .map((item) => withValidSnapshot(item, toDiagnosisSnapshot))
    : [];
  const contracts = Array.isArray(value.contracts)
    ? value.contracts
        .filter(isContract)
        .filter(alive)
        .map((item) => withValidSnapshot(item, toContractSnapshot))
    : [];
  return { diagnoses: diagnoses.sort(byNewest), contracts: contracts.sort(byNewest) };
}

/** useSyncExternalStore 스냅샷용 원본 문자열 */
export function readMyReportsRaw({ storage = defaultStorage() }: Options = {}): string | null {
  try {
    return storage?.getItem(MY_REPORT_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function write(reports: MyReports, storage: SessionStorageLike | null): void {
  try {
    storage?.setItem(
      MY_REPORT_STORAGE_KEY,
      JSON.stringify({
        diagnoses: reports.diagnoses.slice(0, MAX_ITEMS),
        contracts: reports.contracts.slice(0, MAX_ITEMS),
      }),
    );
    // 같은 탭의 분석기록 화면도 바로 다시 그리도록 알린다 (storage 이벤트는 다른 탭에만 온다)
    if (typeof window !== "undefined") window.dispatchEvent(new Event(MY_REPORT_STORAGE_KEY));
  } catch {
    // 저장하지 못하면 목록에 남지 않을 뿐이다
  }
}

function stamp(now: Date) {
  return {
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + RETENTION_DAYS * DAY_MS).toISOString(),
  };
}

export function recordDiagnosis(
  input: { address: string; category_id: string; dong_name: string; snapshot?: DiagnosisSnapshot },
  { storage = defaultStorage(), now = new Date() }: Options = {},
): DiagnosisRecord {
  const record: DiagnosisRecord = { id: newId(), ...input, ...stamp(now) };
  const current = parseMyReports(readMyReportsRaw({ storage }), now);
  write({ ...current, diagnoses: [record, ...current.diagnoses] }, storage);
  return record;
}

/** 계약서 검토를 마치면 남긴다. 가장 최근 진단에 연결한다(없으면 연결 없음) */
export function recordContract(
  status: ContractStatus,
  { storage = defaultStorage(), now = new Date(), snapshot }: Options & { snapshot?: ContractSnapshot } = {},
): ContractRecord {
  const current = parseMyReports(readMyReportsRaw({ storage }), now);
  const latest = current.diagnoses[0];
  const record: ContractRecord = {
    id: newId(),
    status,
    diagnosis: latest ? { id: latest.id, address: latest.address, category_id: latest.category_id } : null,
    ...stamp(now),
    ...(snapshot ? { snapshot } : {}),
  };
  write({ ...current, contracts: [record, ...current.contracts] }, storage);
  return record;
}

/** 내 데이터 모두 삭제·회원 탈퇴 때 비운다 */
export function clearMyReports({ storage = defaultStorage() }: Options = {}): void {
  try {
    storage?.removeItem(MY_REPORT_STORAGE_KEY);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(MY_REPORT_STORAGE_KEY));
  } catch {
    // 지우지 못해도 30일 뒤 목록에서 빠진다
  }
}

export function subscribeMyReports(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener(MY_REPORT_STORAGE_KEY, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(MY_REPORT_STORAGE_KEY, onChange);
  };
}

/** 화면 시안용 예시 기록. 실제 기록처럼 보이지 않게 sample 표시를 붙인다 */
export function sampleReports(now: Date = new Date()): MyReports {
  const at = (daysAgo: number) => {
    const created = new Date(now.getTime() - daysAgo * DAY_MS);
    return stamp(created);
  };
  const first: DiagnosisRecord = {
    id: "sample-diagnosis-1",
    address: "서울 마포구 공덕동 예시 주소",
    category_id: "korean",
    dong_name: "공덕동",
    ...at(2),
    sample: true,
  };
  const second: DiagnosisRecord = {
    id: "sample-diagnosis-2",
    address: "서울 성동구 성수1가 예시 주소",
    category_id: "cafe",
    dong_name: "성수1가1동",
    ...at(6),
    sample: true,
  };
  return {
    diagnoses: [first, second],
    contracts: [
      {
        id: "sample-contract-1",
        status: "confirmed",
        diagnosis: { id: first.id, address: first.address, category_id: first.category_id },
        ...at(1),
        sample: true,
      },
    ],
  };
}

/** 손익에 반영할 계약 조건. 확인한 항목 중 값이 있는 것만 넣는다 (계약서 검토 화면의 반영 규칙과 같다) */
export function appliedFromFields(fields: readonly ContractField[]): AppliedContract {
  const applied: AppliedContract = {};
  for (const field of fields) {
    const value = String(field.input ?? "").trim();
    if (field.ok && value !== "") applied[field.key] = field.numeric ? Math.max(0, Number(value)) : value;
  }
  return applied;
}

/**
 * 기록을 다시 열 때 쓸 진단 입력. 저장한 값이 있으면 그대로, 없으면(예전·예시 기록) 기록의 동·업종과 예시 입력값을 쓴다.
 * 동을 찾지 못하면 첫 예시 동으로 연다.
 */
export function diagnosisSnapshotFor(record: DiagnosisRecord): DiagnosisSnapshot {
  if (record.snapshot) return record.snapshot;
  const neighborhood =
    NEIGHBORHOODS.find((n) => n.shortName === record.dong_name || n.name === record.dong_name) ?? NEIGHBORHOODS[0];
  const category = CATEGORIES.find((c) => c.id === record.category_id) ?? CATEGORIES[0];
  const form: FormState = { ...INITIAL_FORM, ...EXAMPLE_FORM };
  return {
    selection: {
      dongCode: neighborhood?.dongCode ?? "",
      categoryId: category?.id ?? "",
      categoryIds: category ? [category.id] : [],
      radiusM: 500,
      pin: INITIAL_PIN,
    },
    form,
    rentMan: Number(form.rentMan) || 0,
  };
}

/** 계약서 기록을 다시 열 때 쓸 값. 저장한 값이 없으면 예시 계약서를 모두 확인한 것으로 연다 */
export function contractSnapshotFor(record: ContractRecord, reports: MyReports): ContractSnapshot {
  if (record.snapshot) return record.snapshot;
  const fields = createContractFields().map((field) => ({
    ...field,
    ok: true,
    input: field.input || String(field.value ?? ""),
  }));
  const linked = record.diagnosis ? reports.diagnoses.find((d) => d.id === record.diagnosis?.id) : undefined;
  return { fields, applied: appliedFromFields(fields), diagnosis: linked ? diagnosisSnapshotFor(linked) : null };
}
