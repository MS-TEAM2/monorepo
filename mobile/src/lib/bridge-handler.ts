import type { AppToWebMessage, BridgeRequests, WebToAppMessage } from "@ax/bridge";
import { Linking, Share } from "react-native";

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
};

export async function handleBridgeMessage(message: WebToAppMessage): Promise<AppToWebMessage> {
  try {
    const handler = handlers[message.type] as (payload: unknown) => Promise<unknown>;
    return { id: message.id, ok: true, result: await handler(message.payload) };
  } catch (error) {
    return { id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
