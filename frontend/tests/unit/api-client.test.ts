import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ token: null as string | null, cleared: 0 }));
vi.mock("@/lib/session", () => ({
  getSessionToken: () => session.token,
  clearSession: () => {
    session.cleared += 1;
    session.token = null;
  },
}));

import { apiRequest, onUnauthorized } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { defineMock, resetMocks } from "@/lib/api/mock";

const fetchMock = vi.fn<typeof fetch>();

function respond(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValueOnce(
    new Response(status === 204 ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return error instanceof ApiError ? error.kind : "other";
  }
}

beforeEach(() => {
  session.token = null;
  session.cleared = 0;
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.com");
  vi.stubEnv("NEXT_PUBLIC_API_MODE", "live");
  resetMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("토큰", () => {
  it("로그인 전에는 Authorization 없이 부른다", async () => {
    respond(200, { ok: true });
    await apiRequest("/api/v1/categories");
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("토큰이 있으면 Bearer 로 붙인다", async () => {
    session.token = "tok";
    respond(200, { ok: true });
    await apiRequest("/api/v1/users/me");
    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
  });

  it("쿼리와 본문을 보낸다", async () => {
    respond(200, {});
    await apiRequest("/api/v1/stores", { query: { lat: 37.5, categories: ["cafe", "bakery"], skip: null } });
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.example.com/api/v1/stores?lat=37.5&categories=cafe&categories=bakery",
    );

    respond(201, { id: "d1" });
    await apiRequest("/api/v1/diagnoses", { method: "POST", body: { a: 1 } });
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe('{"a":1}');
  });
});

describe("오류 구분", () => {
  it("401·404·409·422·서버·네트워크를 구분한다", async () => {
    const cases: [number, string][] = [
      [401, "unauthorized"],
      [404, "not_found"],
      [409, "conflict"],
      [422, "validation"],
      [500, "server"],
    ];
    for (const [status, kind] of cases) {
      respond(status);
      expect(await kindOf(apiRequest("/x"))).toBe(kind);
    }
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await kindOf(apiRequest("/x"))).toBe("network");
  });

  it("401 이면 토큰을 지우고 알린다", async () => {
    session.token = "tok";
    const handler = vi.fn();
    const off = onUnauthorized(handler);
    respond(401);
    await kindOf(apiRequest("/api/v1/users/me"));
    expect(session.cleared).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("다른 오류에서는 토큰을 지우지 않는다", async () => {
    session.token = "tok";
    respond(500);
    await kindOf(apiRequest("/x"));
    expect(session.cleared).toBe(0);
  });
});

describe("예시 응답", () => {
  it("예시 모드에서는 등록된 예시 응답을 돌려주고 서버를 부르지 않는다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    defineMock("GET", "/api/v1/contracts/{id}", ({ path }) => ({ path }));
    await expect(apiRequest("/api/v1/contracts/ct_1")).resolves.toEqual({ path: "/api/v1/contracts/ct_1" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("예시 응답이 없는 주소는 실제 서버로 보낸다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    respond(200, { status: "ok" });
    await apiRequest("/health");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("live 모드에서는 예시 응답을 쓰지 않는다", async () => {
    defineMock("GET", "/health", () => ({ mocked: true }));
    respond(200, { status: "ok" });
    await expect(apiRequest("/health")).resolves.toEqual({ status: "ok" });
  });

  it("예시 응답에서도 401 이면 토큰을 지운다", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MODE", "mock");
    session.token = "tok";
    defineMock("GET", "/api/v1/users/me", () => {
      throw new ApiError("unauthorized", 401);
    });
    expect(await kindOf(apiRequest("/api/v1/users/me"))).toBe("unauthorized");
    expect(session.cleared).toBe(1);
  });
});
