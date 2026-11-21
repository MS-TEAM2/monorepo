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

/**
 * 앱과 웹이 서로 다른 버전일 때(앱은 스토어 심사로 늦게 배포된다) 기능 지원 여부를 판단하는 번호.
 * - 1: share, openExternal
 * - 2: scanProduct, scanBarcode (네이티브 카메라)
 */
export const BRIDGE_VERSION = 2;

/** 요청별로 필요한 최소 브리지 버전. 웹은 앱의 bridgeVersion 과 비교해 지원 여부를 판단한다. */
export const MIN_BRIDGE_VERSION = {
  share: 1,
  openExternal: 1,
  scanProduct: 2,
  scanBarcode: 2,
} as const satisfies Record<BridgeRequestType, number>;

/** 앱이 웹뷰 User-Agent 끝에 붙이는 이름. 예: "... AXApp/0.1.0" */
export const APP_USER_AGENT_NAME = "AXApp";

/** 앱 정보가 들어 있는 전역 변수 이름 */
export const APP_INFO_GLOBAL = "__AX_APP__";

/**
 * 앱 정보를 넣은 뒤 앱이 window 에 보내는 이벤트 이름.
 * 안드로이드 웹뷰는 페이지 스크립트가 먼저 돌 수 있어, 웹은 이 이벤트로 늦게 들어온 앱 정보를 받는다.
 */
export const APP_INFO_EVENT = "axappinfo";

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
  /**
   * 네이티브 카메라로 상품을 실시간 스캔한다. 카메라가 상품을 비추고 흔들림이 잦아들면 자동으로 찍는다.
   * attempt 는 이번이 몇 번째 시도인지(1부터), hint 는 카메라 위에 띄울 안내 문구.
   * 찍은 사진은 JPEG base64 (data URL 아님). 사용자가 닫으면 cancelled.
   * subject 는 카메라가 실시간으로 잡은 상품 위치(사진 기준 0~1 비율). 프레임 분석을 못 하는 앱(Expo Go 등)은 보내지 않는다.
   */
  scanProduct: {
    payload: { attempt?: number; hint?: string };
    result:
      | {
          status: "captured";
          imageBase64: string;
          width: number;
          height: number;
          subject?: { x: number; y: number; width: number; height: number };
        }
      | { status: "cancelled" };
  };
  /** 네이티브 카메라로 바코드를 읽는다. 사용자가 닫으면 cancelled. */
  scanBarcode: {
    payload: { hint?: string };
    result: { status: "scanned"; code: string; format: string } | { status: "cancelled" };
  };
};

export type BridgeRequestType = keyof BridgeRequests;

/** 앱의 브리지 버전이 이 요청을 지원하는지. 앱 밖(null)이면 false. */
export function supportsRequest(info: Pick<AppInfo, "bridgeVersion"> | null, type: BridgeRequestType): boolean {
  return info !== null && info.bridgeVersion >= MIN_BRIDGE_VERSION[type];
}

export type WebToAppMessage = {
  [K in BridgeRequestType]: { id: string; type: K; payload: BridgeRequests[K]["payload"] };
}[BridgeRequestType];

export type AppToWebMessage = { id: string; ok: true; result: unknown } | { id: string; ok: false; error: string };

const REQUEST_TYPES: readonly BridgeRequestType[] = ["share", "openExternal", "scanProduct", "scanBarcode"];

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
    case "scanProduct":
      return (
        (payload.attempt === undefined || (typeof payload.attempt === "number" && Number.isInteger(payload.attempt))) &&
        isOptionalString(payload.hint)
      );
    case "scanBarcode":
      return isOptionalString(payload.hint);
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

/** 앱이 페이지 로드 전에 주입할 JS 코드. 앱 정보를 전역 변수에 넣고 APP_INFO_EVENT 를 보낸다. */
export function toInjectedAppInfo(info: AppInfo): string {
  return `window.${APP_INFO_GLOBAL} = ${JSON.stringify(info)}; try { window.dispatchEvent(new Event("${APP_INFO_EVENT}")); } catch (e) {} true;`;
}
