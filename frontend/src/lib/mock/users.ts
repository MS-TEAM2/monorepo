import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";

// A02: 로그인 필요. 예시로 원본 정리가 남아 202(삭제 처리 중)로 답한다
defineMock("DELETE", "/api/v1/users/me/data", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return { status: "deleting" };
});

// A28: 예시 계정
defineMock("GET", "/api/v1/users/me", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return { id: "00000000-0000-4000-8000-000000000010", provider: "kakao", created_at: "2026-11-25T00:00:00Z" };
});

// A29: 204 는 본문이 없어 null 로 흉내 낸다
defineMock("POST", "/api/v1/auth/logout", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return null;
});

// A30: 예시로 자료 정리가 남아 202(처리 중)로 답한다
defineMock("DELETE", "/api/v1/users/me", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return { status: "deleting" };
});
