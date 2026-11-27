import { apiRequest } from "./client";

/**
 * A10 GET /api/v1/diagnoses (Notion API 명세서 5장). 로그인 필요.
 * openapi.yaml 에 아직 없어 명세서대로 적었다. BE 명세가 올라오면 생성 타입으로 바꾼다.
 */
export type DiagnosisListItem = {
  id: string;
  address: string;
  category_id: string;
  dong_name: string | null;
  created_at: string;
  expires_at: string;
};

export type DiagnosisList = { items: DiagnosisListItem[]; next_cursor: string | null };

export const listDiagnoses = (options: { limit?: number; cursor?: string } = {}) =>
  apiRequest<DiagnosisList>("/api/v1/diagnoses", { query: { limit: options.limit, cursor: options.cursor } });
