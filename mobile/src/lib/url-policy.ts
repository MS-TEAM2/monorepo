/**
 * 웹뷰 안에서 열지, 밖(기본 브라우저·다른 앱)으로 보낼지 정한다.
 * React Native 에 의존하지 않는 순수 함수만 둔다 (vitest 로 테스트).
 */

/** 웹뷰가 처리하는 내부 동작용 주소 */
const WEBVIEW_INTERNAL = /^(about:blank|about:srcdoc|data:|blob:|javascript:)/;

/** 우리 웹과 같은 출처(origin)면 웹뷰 안에서 연다. 그 밖의 http(s)·tel:·mailto: 등은 밖에서 연다. */
export function shouldOpenInWebView(url: string, webUrl: string): boolean {
  if (WEBVIEW_INTERNAL.test(url)) return true;
  try {
    return new URL(url).origin === new URL(webUrl).origin;
  } catch {
    return false;
  }
}

/**
 * Expo 개발 서버 주소(hostUri, 예: "192.168.0.10:8081")에서 호스트만 뽑아 웹 개발 서버 주소를 만든다.
 * 휴대폰에서 localhost 는 휴대폰 자신이므로 PC의 네트워크 주소가 필요하다.
 */
export function devWebUrl(hostUri: string | undefined, port: number): string | null {
  if (!hostUri) return null;
  const host = hostUri.split(":")[0];
  return host ? `http://${host}:${port}` : null;
}
