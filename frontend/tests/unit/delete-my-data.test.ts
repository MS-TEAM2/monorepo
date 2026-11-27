import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DELETION_TARGETS, DeletionResult } from "@/components/about-data/delete-my-data";
import { ApiError } from "@/lib/api/errors";
import { findMock } from "@/lib/api/mock";
import { deletionOutcome } from "@/lib/api/users";
import "@/lib/mock";

describe("내 데이터 모두 삭제 (A02, 스펙 specs/session-privacy R3·R6)", () => {
  it("204 는 완료, 202 는 삭제 처리 중으로 본다", () => {
    expect(deletionOutcome(undefined)).toBe("done");
    expect(deletionOutcome(null)).toBe("done");
    expect(deletionOutcome({ status: "deleting" })).toBe("deleting");
  });

  it("완료·처리 중 모두 로그인이 유지된다고 알린다", () => {
    const done = renderToStaticMarkup(createElement(DeletionResult, { outcome: "done" }));
    const deleting = renderToStaticMarkup(createElement(DeletionResult, { outcome: "deleting" }));
    expect(done).toContain("모두 삭제했어요");
    expect(deleting).toContain("삭제 처리 중");
    expect(done).toContain("로그인은 그대로");
    expect(deleting).toContain("로그인은 그대로");
  });

  it("확인 창에 지울 대상을 모두 적는다", () => {
    expect(DELETION_TARGETS).toEqual(
      expect.arrayContaining(["진단과 손익 계산", "저장한 자리", "남아 있는 계약서 원본과 글자 인식 보관분"]),
    );
  });

  it("예시 응답도 로그인하지 않으면 401 이다", () => {
    const handler = findMock("DELETE", "/api/v1/users/me/data");
    const request = {
      method: "DELETE" as const,
      path: "/api/v1/users/me/data",
      query: new URLSearchParams(),
      body: undefined,
    };
    expect(() => handler?.({ ...request, authenticated: false })).toThrow(ApiError);
    expect(handler?.({ ...request, authenticated: true })).toEqual({ status: "deleting" });
  });
});
