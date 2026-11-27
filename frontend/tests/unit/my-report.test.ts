import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/saved",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/use-session", () => ({ useSessionStatus: () => "logged_in" }));

import { MyReportScreen } from "@/components/screens/my-report-screen";
import { StartupProvider } from "@/components/screens/startup-provider";
import { createContractFields, INITIAL_FORM, INITIAL_PIN, NEIGHBORHOODS } from "@/lib/mock/startup/data";
import {
  appliedFromFields,
  clearMyReports,
  contractSnapshotFor,
  diagnosisSnapshotFor,
  MY_REPORT_STORAGE_KEY,
  parseMyReports,
  readMyReportsRaw,
  recordContract,
  recordDiagnosis,
  sampleReports,
} from "@/lib/my-report";
import type { SessionStorageLike } from "@/lib/session";

function memoryStorage(): SessionStorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const NOW = new Date("2026-11-27T00:00:00Z");
const DIAGNOSIS = { address: "마포 공덕동 선택 위치", category_id: "korean", dong_name: "공덕동" };

describe("분석기록 저장 (이 브라우저)", () => {
  it("진단과 계약서 기록을 최신순으로 쌓고, 계약서는 가장 최근 진단에 연결한다", () => {
    const storage = memoryStorage();
    const first = recordDiagnosis(DIAGNOSIS, { storage, now: NOW });
    const second = recordDiagnosis(
      { ...DIAGNOSIS, category_id: "cafe" },
      { storage, now: new Date("2026-11-27T01:00:00Z") },
    );
    const contract = recordContract("confirmed", { storage, now: new Date("2026-11-27T02:00:00Z") });

    const reports = parseMyReports(readMyReportsRaw({ storage }), NOW);
    expect(reports.diagnoses.map((d) => d.id)).toEqual([second.id, first.id]);
    expect(contract.diagnosis?.id).toBe(second.id);
    expect(reports.contracts).toHaveLength(1);
  });

  it("30일이 지난 기록은 목록에서 뺀다", () => {
    const storage = memoryStorage();
    recordDiagnosis(DIAGNOSIS, { storage, now: NOW });
    const later = new Date(NOW.getTime() + 31 * 24 * 60 * 60 * 1000);
    expect(parseMyReports(readMyReportsRaw({ storage }), later).diagnoses).toEqual([]);
  });

  it("진단이 없으면 계약서는 연결 없이 남는다", () => {
    expect(recordContract("needs_review", { storage: memoryStorage(), now: NOW }).diagnosis).toBeNull();
  });

  it("모양이 틀린 저장값은 빈 목록이고, 비우면 키를 지운다", () => {
    expect(parseMyReports("{oops", NOW)).toEqual({ diagnoses: [], contracts: [] });
    const storage = memoryStorage();
    recordDiagnosis(DIAGNOSIS, { storage, now: NOW });
    clearMyReports({ storage });
    expect(storage.getItem(MY_REPORT_STORAGE_KEY)).toBeNull();
  });

  it("예시 기록에는 예시 표시가 붙는다", () => {
    const samples = sampleReports(NOW);
    expect([...samples.diagnoses, ...samples.contracts].every((item) => item.sample)).toBe(true);
  });
});

describe("분석기록 화면", () => {
  const markup = () => renderToStaticMarkup(createElement(StartupProvider, null, createElement(MyReportScreen)));

  it("진단·계약서 목록을 위에, 데이터 삭제·계정·개인정보 처리를 아래에 둔다", () => {
    const html = markup();
    const order = ['id="my-diagnoses"', 'id="my-contracts"', 'id="delete-my-data"', 'id="account"', 'id="privacy"'].map(
      (id) => html.indexOf(id),
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("데이터 출처나 한계는 보여 주지 않고 예시 기록에는 표시를 붙인다", () => {
    const html = markup();
    expect(html).toContain("내 분석기록");
    expect(html).not.toContain("MY 리포트");
    expect(html).toContain("예시 데이터");
    expect(html).not.toContain("데이터 출처");
  });
});

describe("분석기록 다시 보기 (SCRUM-208)", () => {
  const gongdeok = NEIGHBORHOODS.find((n) => n.shortName === "공덕동") ?? NEIGHBORHOODS[0];
  const SNAPSHOT = {
    selection: {
      dongCode: gongdeok?.dongCode ?? "",
      categoryId: "korean",
      categoryIds: ["korean"],
      radiusM: 300 as const,
      pin: { x: 120, y: 80 },
    },
    form: { ...INITIAL_FORM, rentMan: "320", areaM2: "40" },
    rentMan: 320,
  };

  it("진단 기록에 그때의 선택값·입력값을 남기고 그대로 읽는다", () => {
    const storage = memoryStorage();
    recordDiagnosis({ ...DIAGNOSIS, snapshot: SNAPSHOT }, { storage, now: NOW });
    const [saved] = parseMyReports(readMyReportsRaw({ storage }), NOW).diagnoses;
    expect(saved?.snapshot).toEqual(SNAPSHOT);
    expect(saved && diagnosisSnapshotFor(saved)).toEqual(SNAPSHOT);
  });

  it("계약서 기록에 항목·반영값·진단 입력을 남긴다", () => {
    const storage = memoryStorage();
    const fields = createContractFields().map((f) => ({ ...f, ok: true, input: f.input || String(f.value ?? "") }));
    const snapshot = { fields, applied: appliedFromFields(fields), diagnosis: SNAPSHOT };
    recordContract("confirmed", { storage, now: NOW, snapshot });
    const reports = parseMyReports(readMyReportsRaw({ storage }), NOW);
    const [saved] = reports.contracts;
    expect(saved && contractSnapshotFor(saved, reports)).toEqual(snapshot);
  });

  it("입력 스냅샷 모양이 틀리면 스냅샷만 버리고 기록은 남긴다", () => {
    const storage = memoryStorage();
    recordDiagnosis(DIAGNOSIS, { storage, now: NOW });
    const raw = JSON.parse(readMyReportsRaw({ storage }) ?? "{}");
    raw.diagnoses[0].snapshot = { selection: { dongCode: 1 }, form: {}, rentMan: "x" };
    storage.setItem(MY_REPORT_STORAGE_KEY, JSON.stringify(raw));
    const [saved] = parseMyReports(readMyReportsRaw({ storage }), NOW).diagnoses;
    expect(saved).toBeDefined();
    expect(saved?.snapshot).toBeUndefined();
  });

  it("입력값 없는 예전·예시 진단은 기록의 동·업종과 예시 입력값으로 연다", () => {
    const [sample] = sampleReports(NOW).diagnoses;
    const snapshot = sample && diagnosisSnapshotFor(sample);
    expect(snapshot?.selection).toMatchObject({ dongCode: gongdeok?.dongCode, categoryId: "korean", pin: INITIAL_PIN });
    expect(snapshot?.rentMan).toBe(Number(snapshot?.form.rentMan));
  });

  it("입력값 없는 계약서는 예시 계약서를 모두 확인한 것으로 열고 연결된 진단 입력을 함께 쓴다", () => {
    const reports = sampleReports(NOW);
    const [contract] = reports.contracts;
    const snapshot = contract && contractSnapshotFor(contract, reports);
    expect(Object.keys(snapshot?.applied ?? {}).length).toBeGreaterThan(0);
    expect(snapshot?.diagnosis?.selection.categoryId).toBe("korean");
  });

  it("손익 반영값은 확인한 항목 중 값이 있는 것만 넣는다", () => {
    const [first, second] = createContractFields();
    if (!first || !second) throw new Error("예시 계약서 항목이 없다");
    const applied = appliedFromFields([
      { ...first, ok: true, input: "12" },
      { ...second, ok: false, input: "99" },
    ]);
    expect(Object.keys(applied)).toEqual([first.key]);
  });
});
