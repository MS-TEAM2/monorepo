import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/use-session", () => ({ useSessionStatus: () => "logged_out" }));

import HomePage from "@/app/page";
import ContractPage from "@/app/contract/page";
import { homeContinueView } from "@/lib/home";
import { SAMPLE_DIAGNOSIS_LIST_ITEM } from "@/lib/mock/diagnoses";

describe("S01 홈", () => {
  it("두 시작 버튼과 서울·외식 9종 지원 범위를 보여 준다", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup).toContain('href="/explore"');
    expect(markup).toContain("주변 상권 보기");
    expect(markup).toContain('href="/prototype"');
    expect(markup).toContain("핵심 흐름 시연하기");
    expect(markup).toContain('href="/diagnose"');
    expect(markup).toContain("정해 둔 자리 진단하기");
    expect(markup).toContain("서울, 외식업 9종");
    expect(markup.match(/<li class="rounded-full/g)).toHaveLength(9);
  });

  it("계약서 메뉴에서 계약 확인 데모와 전체 흐름으로 이동할 수 있다", () => {
    const markup = renderToStaticMarkup(createElement(ContractPage));
    expect(markup).toContain('href="/contract/review"');
    expect(markup).toContain('href="/prototype"');
    expect(markup).toContain("계약 조건 시연 열기");
    expect(markup).toContain("전체 흐름 시연하기");
    expect(markup).toContain("실제 파일 업로드, OCR, 로그인, 서버 저장은 연결되지 않았습니다.");
  });

  it("로그인 전에는 로그인 버튼을 보여 준다", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup).toContain('href="/login"');
  });
});

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
