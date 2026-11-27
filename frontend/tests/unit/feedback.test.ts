import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorNotice } from "@/components/feedback/error-notice";
import { SampleDataBadge, SampleDataNotice } from "@/components/feedback/sample-data";
import { ApiError, ERROR_COPY, errorKindFromStatus, toErrorKind, type ApiErrorKind } from "@/lib/api/errors";

const noop = () => {};

describe("errorKindFromStatus", () => {
  it("R5의 오류를 구분한다", () => {
    expect(errorKindFromStatus(401)).toBe("unauthorized");
    expect(errorKindFromStatus(404)).toBe("not_found");
    expect(errorKindFromStatus(403)).toBe("not_found");
    expect(errorKindFromStatus(409)).toBe("conflict");
    expect(errorKindFromStatus(422)).toBe("validation");
    expect(errorKindFromStatus(500)).toBe("server");
    expect(errorKindFromStatus(503)).toBe("server");
    expect(errorKindFromStatus(null)).toBe("network");
  });

  it("던져진 값을 오류 종류로 바꾼다", () => {
    expect(toErrorKind(new ApiError("conflict", 409))).toBe("conflict");
    expect(toErrorKind(new TypeError("Failed to fetch"))).toBe("network");
    expect(toErrorKind(new Error("?"))).toBe("server");
  });
});

describe("ErrorNotice", () => {
  const kinds = Object.keys(ERROR_COPY) as ApiErrorKind[];

  it("모든 오류에 제목과 설명이 있고 alert로 읽힌다", () => {
    for (const kind of kinds) {
      const markup = renderToStaticMarkup(createElement(ErrorNotice, { kind }));
      expect(markup).toContain('role="alert"');
      expect(markup).toContain(ERROR_COPY[kind].title);
    }
  });

  it("다시 시도는 다시 시도할 수 있는 오류에서만 보인다", () => {
    for (const kind of kinds) {
      const markup = renderToStaticMarkup(createElement(ErrorNotice, { kind, onRetry: noop }));
      expect(markup.includes("다시 시도</button>")).toBe(ERROR_COPY[kind].retryable);
    }
  });

  it("401에서만 로그인 버튼을 보인다", () => {
    expect(renderToStaticMarkup(createElement(ErrorNotice, { kind: "unauthorized", onLogin: noop }))).toContain(
      "로그인하기",
    );
    expect(renderToStaticMarkup(createElement(ErrorNotice, { kind: "server", onLogin: noop }))).not.toContain(
      "로그인하기",
    );
  });

  it("화면별 설명을 덧붙일 수 있다", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorNotice, { kind: "network", context: "매장을 못 불러왔어요." }),
    );
    expect(markup).toContain("매장을 못 불러왔어요.");
  });
});

describe("예시 데이터 표시", () => {
  it("배지와 안내에 '예시 데이터'가 보인다", () => {
    expect(renderToStaticMarkup(createElement(SampleDataBadge))).toContain("예시 데이터");
    const notice = renderToStaticMarkup(createElement(SampleDataNotice));
    expect(notice).toContain("예시 데이터");
    expect(notice).toContain('role="note"');
  });
});
