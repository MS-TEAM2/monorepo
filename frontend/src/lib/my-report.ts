/**
 * 분석기록(S09)의 진단·계약서 검토 기록. 진단·계약서 화면이 아직 예시 계산이라 서버(A09·A15)에 저장하지 않으므로,
 * 로그인한 상태에서 예시 화면을 쓰면 이 브라우저의 localStorage 에 쌓는다.
 * 항목 모양은 A10(GET /diagnoses)·A32(GET /contracts) 응답과 같게 두어 API를 붙일 때 목록만 바꾸면 되게 한다.
 * 보관 기간은 명세와 같은 30일이다. 서버로 보내지 않는다.
 */

import type { SessionStorageLike } from "@/lib/session";

export const MY_REPORT_STORAGE_KEY = "jcs.myReport.v1";

const RETENTION_DAYS = 30;
const MAX_ITEMS = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A10 DiagnosisListItem 과 같은 모양. sample 은 화면에 `예시 데이터`로 표시한다 */
export type DiagnosisRecord = {
  id: string;
  address: string;
  category_id: string;
  dong_name: string;
  created_at: string;
  expires_at: string;
  sample?: boolean;
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
  const diagnoses = Array.isArray(value.diagnoses) ? value.diagnoses.filter(isDiagnosis).filter(alive) : [];
  const contracts = Array.isArray(value.contracts) ? value.contracts.filter(isContract).filter(alive) : [];
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
  input: { address: string; category_id: string; dong_name: string },
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
  { storage = defaultStorage(), now = new Date() }: Options = {},
): ContractRecord {
  const current = parseMyReports(readMyReportsRaw({ storage }), now);
  const latest = current.diagnoses[0];
  const record: ContractRecord = {
    id: newId(),
    status,
    diagnosis: latest ? { id: latest.id, address: latest.address, category_id: latest.category_id } : null,
    ...stamp(now),
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
