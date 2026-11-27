import type { DataStatus } from "@/lib/api/data-status";
import { defineMock } from "@/lib/api/mock";

/**
 * A24 예시 응답. 화면 확인용 예시 값이다(실측 아님). 매장 기준일은 A05 예시와 맞춘다.
 * 실패·수집 전 상태를 함께 보여 주려고 일부 자료를 실패·미수집으로 둔다. 모델은 아직 없다(null).
 */
export const SAMPLE_DATA_STATUS: DataStatus = {
  items: [
    {
      dataset: "stores_general",
      base_date: "2026-11-22",
      base_quarter: null,
      last_run_status: "succeeded",
      last_run_at: "2026-11-25T00:00:00Z",
      last_success_at: "2026-11-25T00:00:00Z",
      stale: false,
      missing_location_count: 100,
      source_url: "https://data.seoul.go.kr/dataList/OA-16094/S/1/datasetView.do",
    },
    {
      dataset: "stores_rest",
      base_date: "2026-11-22",
      base_quarter: null,
      last_run_status: "failed",
      last_run_at: "2026-11-26T00:00:00Z",
      last_success_at: "2026-11-25T00:00:00Z",
      stale: false,
      missing_location_count: 40,
      source_url: "https://data.seoul.go.kr/",
    },
    {
      dataset: "stores_bakery",
      base_date: "2026-11-22",
      base_quarter: null,
      last_run_status: "succeeded",
      last_run_at: "2026-11-25T00:00:00Z",
      last_success_at: "2026-11-25T00:00:00Z",
      stale: false,
      missing_location_count: 5,
      source_url: "https://data.seoul.go.kr/",
    },
    {
      dataset: "region_population",
      base_date: null,
      base_quarter: "20262",
      last_run_status: "succeeded",
      last_run_at: "2026-11-25T00:00:00Z",
      last_success_at: "2026-11-25T00:00:00Z",
      stale: false,
      missing_location_count: null,
      source_url: "https://data.seoul.go.kr/",
    },
    {
      dataset: "region_store_stats",
      base_date: null,
      base_quarter: "20262",
      last_run_status: "succeeded",
      last_run_at: "2026-11-25T00:00:00Z",
      last_success_at: "2026-11-25T00:00:00Z",
      stale: false,
      missing_location_count: null,
      source_url: "https://data.seoul.go.kr/",
    },
    {
      dataset: "region_sales",
      base_date: null,
      base_quarter: null,
      last_run_status: null,
      last_run_at: null,
      last_success_at: null,
      stale: true,
      missing_location_count: null,
      source_url: "https://data.seoul.go.kr/",
    },
  ],
  model: null,
};

defineMock("GET", "/api/v1/data-status", () => SAMPLE_DATA_STATUS);
