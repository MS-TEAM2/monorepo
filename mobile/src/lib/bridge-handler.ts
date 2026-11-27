import type { AppToWebMessage, BridgeRequests, WebToAppMessage } from "@ax/bridge";
import * as WebBrowser from "expo-web-browser";
import { Linking, Share } from "react-native";

import { AUTH_RETURN_URL, isAllowedAuthCallback, isAllowedAuthStart } from "./auth-url-policy";

type Handlers = {
  [K in keyof BridgeRequests]: (payload: BridgeRequests[K]["payload"]) => Promise<BridgeRequests[K]["result"]>;
};

const SAFE_EXTERNAL_SCHEMES = /^(https?:|tel:|mailto:|sms:)/;
/** 웹이 요청할 수 있는 네이티브 기능. 요청을 추가하면 packages/bridge 의 BridgeRequests 와 함께 고친다. */
const handlers: Handlers = {
  async share({ message, url, title }) {
    const result = await Share.share({ message: url ? `${message}\n${url}` : message, url, title });
    return { shared: result.action === Share.sharedAction };
  },
  async openExternal({ url }) {
    // 웹뷰 안의 페이지가 임의의 앱 스킴을 열지 못하게 허용 목록만 연다
    if (!SAFE_EXTERNAL_SCHEMES.test(url)) throw new Error(`허용하지 않는 주소입니다: ${url}`);
    await Linking.openURL(url);
    return { opened: true };
  },
  async openAuthSession({ url, returnUrl, timeoutMs }) {
    if (!isAllowedAuthStart(url)) throw new Error("허용하지 않는 로그인 주소입니다.");
    if (returnUrl !== AUTH_RETURN_URL) throw new Error("허용하지 않는 로그인 복귀 주소입니다.");

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const result = await Promise.race([
      WebBrowser.openAuthSessionAsync(url, returnUrl),
      new Promise<{ type: "timeout" }>((resolve) => {
        timeout = setTimeout(() => resolve({ type: "timeout" }), timeoutMs);
      }),
    ]).finally(() => {
      if (timeout) clearTimeout(timeout);
    });

    if (result.type === "timeout") {
      WebBrowser.dismissAuthSession();
      return { type: "timeout" };
    }
    if (result.type === "cancel" || result.type === "dismiss") return { type: result.type };
    if (result.type !== "success") throw new Error("로그인 브라우저 응답을 확인할 수 없습니다.");

    if (!isAllowedAuthCallback(result.url)) {
      throw new Error("허용하지 않는 로그인 복귀 주소입니다.");
    }
    return { type: "success", url: new URL(result.url).href };
  },
};

export async function handleBridgeMessage(message: WebToAppMessage): Promise<AppToWebMessage> {
  try {
    const handler = handlers[message.type] as (payload: unknown) => Promise<unknown>;
    return { id: message.id, ok: true, result: await handler(message.payload) };
  } catch (error) {
    return { id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
