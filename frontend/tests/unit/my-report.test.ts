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
import {
  clearMyReports,
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
