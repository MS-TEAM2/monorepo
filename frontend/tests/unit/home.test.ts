import { describe, expect, it } from "vitest";

import { homeContinueView } from "@/lib/home";
import { SAMPLE_DIAGNOSIS_LIST_ITEM } from "@/lib/mock/diagnoses";

describe("이어 보기", () => {
  it("로그인 전에는 로그인 버튼", () => {
    expect(homeContinueView("logged_out", SAMPLE_DIAGNOSIS_LIST_ITEM)).toEqual({ kind: "login" });
  });

  it("로그인했고 최근 진단이 있으면 이어 보기", () => {
    expect(homeContinueView("logged_in", SAMPLE_DIAGNOSIS_LIST_ITEM)).toEqual({
      kind: "continue",
      diagnosis: SAMPLE_DIAGNOSIS_LIST_ITEM,
    });
  });

  it("로그인했지만 진단이 없으면 아무것도 보이지 않는다", () => {
    expect(homeContinueView("logged_in", null)).toEqual({ kind: "none" });
  });

  it("불러오는 중에는 로딩", () => {
    expect(homeContinueView("logged_in", undefined)).toEqual({ kind: "loading" });
  });
});
