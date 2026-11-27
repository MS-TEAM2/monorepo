export const AUTH_RETURN_URL = "axservice://auth/callback";

/** 웹뷰 브리지 요청 중 A26 소셜 로그인 시작 주소만 시스템 브라우저로 허용한다. */
export function isAllowedAuthStart(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.username === "" &&
      parsed.password === "" &&
      /^\/api\/v1\/auth\/(google|kakao)\/start$/.test(parsed.pathname) &&
      parsed.searchParams.get("client") === "app" &&
      /^[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get("code_challenge") ?? "") &&
      Boolean(parsed.searchParams.get("terms_version"))
    );
  } catch {
    return false;
  }
}

export function isAllowedAuthCallback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}` === AUTH_RETURN_URL;
  } catch {
    return false;
  }
}
