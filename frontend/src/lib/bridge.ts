import {
  APP_INFO_GLOBAL,
  type AppInfo,
  type AppToWebMessage,
  type BridgeRequests,
  type BridgeRequestType,
  supportsRequest,
  WEB_RECEIVE_FUNCTION,
} from "@ax/bridge";

/** 앱(React Native 웹뷰)에서 실행 중일 때만 생기는 전역 값들 */
type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage(message: string): void };
  [APP_INFO_GLOBAL]?: AppInfo;
  [WEB_RECEIVE_FUNCTION]?: (message: AppToWebMessage) => void;
};

const TIMEOUT_MS = 30_000;
const pending = new Map<string, { resolve(value: unknown): void; reject(error: Error): void }>();

function bridgeWindow(): BridgeWindow | null {
  return typeof window === "undefined" ? null : (window as BridgeWindow);
}

/**
 * 앱 안에서 실행 중이면 앱 정보, 브라우저면 null.
 * 서버에서 미리 그린 HTML 에는 항상 null 이므로, 화면에 쓸 때는 useAppInfo() 를 쓴다.
 */
export function getAppInfo(): AppInfo | null {
  return bridgeWindow()?.[APP_INFO_GLOBAL] ?? null;
}

/** 앱 안이고, 앱의 브리지 버전이 이 요청을 지원하는지 */
export function canCallApp(type: BridgeRequestType): boolean {
  return isInApp() && supportsRequest(getAppInfo(), type);
}

export function isInApp(): boolean {
  return Boolean(bridgeWindow()?.ReactNativeWebView);
}

function installReceiver(w: BridgeWindow) {
  if (w[WEB_RECEIVE_FUNCTION]) return;
  w[WEB_RECEIVE_FUNCTION] = (message) => {
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.ok) request.resolve(message.result);
    else request.reject(new Error(message.error));
  };
}

/**
 * 앱의 네이티브 기능을 호출한다. 브라우저에서는 실패하므로 isInApp() 으로 먼저 확인하고 웹 대체 동작을 둔다.
 *
 *   if (isInApp()) await callApp("share", { message: "같이 봐요", url });
 *   else await navigator.share?.({ text: "같이 봐요", url });
 */
export function callApp<K extends BridgeRequestType>(
  type: K,
  payload: BridgeRequests[K]["payload"],
  /** timeoutMs: null 이면 기다림 제한 없음 (카메라처럼 사용자가 끝낼 때까지 걸리는 요청) */
  options: { timeoutMs?: number | null } = {},
): Promise<BridgeRequests[K]["result"]> {
  const w = bridgeWindow();
  if (!w?.ReactNativeWebView) return Promise.reject(new Error("앱 안에서만 쓸 수 있는 기능입니다"));
  installReceiver(w);

  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs === undefined ? TIMEOUT_MS : options.timeoutMs;
    const timer =
      timeoutMs === null
        ? undefined
        : setTimeout(() => {
            pending.delete(id);
            reject(new Error(`앱 응답 시간 초과: ${type}`));
          }, timeoutMs);
    pending.set(id, {
      resolve: (value) => {
        clearTimeout(timer);
        resolve(value as BridgeRequests[K]["result"]);
      },
      reject: (error) => {
        clearTimeout(timer);
        reject(error);
      },
    });
    w.ReactNativeWebView!.postMessage(JSON.stringify({ id, type, payload }));
  });
}
