/**
 * 웹(frontend)과 앱(mobile) 웹뷰 사이의 메시지 계약.
 *
 * - 웹 → 앱: window.ReactNativeWebView.postMessage(JSON) 로 요청을 보낸다.
 * - 앱 → 웹: window[WEB_RECEIVE_FUNCTION](응답) 을 호출해 결과를 돌려준다.
 * - 앱은 페이지가 뜨기 전에 window[APP_INFO_GLOBAL] 에 앱 정보를 넣어 둔다.
 *
 * 요청을 추가할 때는 BridgeRequests 에 한 줄 추가하고, 앱의 처리기(mobile/src/lib/bridge-handler.ts)를 함께 고친다.
 * 이 파일은 웹과 앱이 함께 쓰므로 브라우저·React Native 전용 API를 쓰지 않는다.
 */

/** 앱과 웹이 서로 다른 버전일 때(앱은 스토어 심사로 늦게 배포된다) 기능 지원 여부를 판단하는 번호. */
export const BRIDGE_VERSION = 2;

/** 앱이 웹뷰 User-Agent 끝에 붙이는 이름. 예: "... AXApp/0.1.0" */
export const APP_USER_AGENT_NAME = "AXApp";

/** 앱 정보가 들어 있는 전역 변수 이름 */
export const APP_INFO_GLOBAL = "__AX_APP__";

/** 앱이 응답을 전달할 때 호출하는 웹의 전역 함수 이름 */
export const WEB_RECEIVE_FUNCTION = "__axBridgeReceive";

export type AppPlatform = "ios" | "android";

export type AppInfo = {
  platform: AppPlatform;
  appVersion: string;
  bridgeVersion: number;
};

/** 요청 종류별 입력(payload)과 결과(result) */
export type BridgeRequests = {
  /** OS 공유 시트 열기 */
  share: {
    payload: { message: string; url?: string; title?: string };
    result: { shared: boolean };
  };
  /** 외부 브라우저·다른 앱으로 열기 (tel:, mailto: 포함) */
  openExternal: {
    payload: { url: string };
    result: { opened: boolean };
  };
  /** 시스템 인증 브라우저를 열고 지정한 앱 콜백 주소에서 결과를 돌려준다. */
  openAuthSession: {
    payload: { url: string; returnUrl: string; timeoutMs: number };
    result: { type: "success"; url: string } | { type: "cancel" | "dismiss" | "timeout" };
  };
};

export type BridgeRequestType = keyof BridgeRequests;

export type WebToAppMessage = {
  [K in BridgeRequestType]: { id: string; type: K; payload: BridgeRequests[K]["payload"] };
}[BridgeRequestType];

export type AppToWebMessage = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };

const REQUEST_TYPES: readonly BridgeRequestType[] = ["share", "openExternal", "openAuthSession"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === "string";
}

function isValidPayload(type: BridgeRequestType, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  switch (type) {
    case "share":
      return typeof payload.message === "string" && isOptionalString(payload.url) && isOptionalString(payload.title);
    case "openExternal":
      return typeof payload.url === "string";
    case "openAuthSession":
      return (
        typeof payload.url === "string" &&
        typeof payload.returnUrl === "string" &&
        typeof payload.timeoutMs === "number" &&
        Number.isSafeInteger(payload.timeoutMs) &&
        payload.timeoutMs > 0 &&
        payload.timeoutMs <= 5 * 60_000
      );
  }
}

/**
 * 웹에서 온 문자열을 검증해 요청으로 바꾼다. 형식이 틀리면 null.
 * 웹뷰 안의 페이지가 보낸 값은 신뢰하지 않고 항상 이 함수를 거친다.
 */
export function parseWebToAppMessage(raw: string): WebToAppMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data) || typeof data.id !== "string" || typeof data.type !== "string") return null;
  const type = data.type as BridgeRequestType;
  if (!REQUEST_TYPES.includes(type) || !isValidPayload(type, data.payload)) return null;
  return data as WebToAppMessage;
}

/** 앱이 웹뷰에 주입할 JS 코드. 응답을 JSON 으로 직렬화해 웹의 수신 함수에 넘긴다. */
export function toInjectedResponse(message: AppToWebMessage): string {
  return `window.${WEB_RECEIVE_FUNCTION} && window.${WEB_RECEIVE_FUNCTION}(${JSON.stringify(message)}); true;`;
}

/** 앱이 페이지 로드 전에 주입할 JS 코드. 앱 정보를 전역 변수에 넣는다. */
export function toInjectedAppInfo(info: AppInfo): string {
  return `window.${APP_INFO_GLOBAL} = ${JSON.stringify(info)}; true;`;
}
