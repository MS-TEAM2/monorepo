import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";
import { MOCK_LOGIN_CODE } from "@/lib/auth";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// A01: 예시 모드의 로그인 버튼이 주는 1회용 코드만 받는다. 다른 코드는 만료·재사용으로 본다(400)
defineMock("POST", "/api/v1/auth/token", ({ body }) => {
  const valid =
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    "code_verifier" in body &&
    body.code === MOCK_LOGIN_CODE &&
    typeof body.code_verifier === "string" &&
    body.code_verifier !== "";
  if (!valid) throw new ApiError("validation", 400, "invalid_grant");
  return { token: "mock-session-token", expires_at: new Date(Date.now() + THIRTY_DAYS_MS).toISOString() };
});
