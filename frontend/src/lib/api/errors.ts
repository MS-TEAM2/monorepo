/**
 * API 오류 종류와 화면 문구 (스펙 specs/fe-foundation R5).
 * 모든 화면이 같은 문구와 다시 시도 방식을 쓰도록 여기서만 정한다.
 * API 클라이언트(SCRUM-91)는 응답을 ApiError 로 바꿔 던지고, 화면은 ErrorNotice 로 보여 준다.
 * 문구는 초안이다. 확정은 팀이 한다(스펙 "확인 필요").
 */

export type ApiErrorKind = "unauthorized" | "not_found" | "conflict" | "validation" | "network" | "server";

export type ErrorCopy = {
  title: string;
  description: string;
  /** 다시 시도 버튼을 보여 줄지. 같은 요청을 다시 보내 풀릴 수 있는 오류만 true */
  retryable: boolean;
  /** 로그인 화면으로 보내야 하는 오류 */
  needsLogin: boolean;
};

export const ERROR_COPY: Record<ApiErrorKind, ErrorCopy> = {
  unauthorized: {
    title: "로그인이 필요해요",
    description: "로그인이 만료됐거나 로그인하지 않았어요. 로그인하면 보던 화면으로 돌아와요.",
    retryable: false,
    needsLogin: true,
  },
  not_found: {
    title: "자료를 찾을 수 없어요",
    description: "삭제됐거나 다른 계정의 자료일 수 있어요.",
    retryable: false,
    needsLogin: false,
  },
  conflict: {
    title: "다른 작업과 겹쳤어요",
    description: "진행 중인 작업이 끝난 뒤 다시 시도해 주세요.",
    retryable: true,
    needsLogin: false,
  },
  validation: {
    title: "입력값을 확인해 주세요",
    description: "형식이 맞지 않거나 범위를 벗어난 값이 있어요.",
    retryable: false,
    needsLogin: false,
  },
  network: {
    title: "인터넷 연결을 확인해 주세요",
    description: "연결이 끊겼거나 응답이 늦어요. 연결을 확인한 뒤 다시 시도해 주세요.",
    retryable: true,
    needsLogin: false,
  },
  server: {
    title: "잠시 후 다시 시도해 주세요",
    description: "서버에서 문제가 생겼어요. 입력한 내용은 그대로 있어요.",
    retryable: true,
    needsLogin: false,
  },
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;

  constructor(kind: ApiErrorKind, status: number | null, message?: string) {
    super(message ?? ERROR_COPY[kind].title);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

/** HTTP 상태 코드를 오류 종류로 바꾼다. 상태가 없으면(요청 자체 실패) network */
export function errorKindFromStatus(status: number | null): ApiErrorKind {
  if (status === null) return "network";
  if (status === 401) return "unauthorized";
  if (status === 403 || status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "validation";
  return "server";
}

/** 어떤 값이 던져졌든 화면에 보여 줄 오류 종류로 바꾼다 */
export function toErrorKind(error: unknown): ApiErrorKind {
  if (error instanceof ApiError) return error.kind;
  if (error instanceof TypeError) return "network";
  return "server";
}
