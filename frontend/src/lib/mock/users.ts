import { ApiError } from "@/lib/api/errors";
import { defineMock } from "@/lib/api/mock";

// A02: 로그인 필요. 예시로 원본 정리가 남아 202(삭제 처리 중)로 답한다
defineMock("DELETE", "/api/v1/users/me/data", ({ authenticated }) => {
  if (!authenticated) throw new ApiError("unauthorized", 401, "unauthorized");
  return { status: "deleting" };
});
