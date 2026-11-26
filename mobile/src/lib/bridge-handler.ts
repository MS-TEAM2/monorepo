import type { AppToWebMessage, BridgeRequests, ScannedPage, WebToAppMessage } from "@ax/bridge";
import { Linking, Share } from "react-native";

type Handlers = {
  [K in keyof BridgeRequests]: (payload: BridgeRequests[K]["payload"]) => Promise<BridgeRequests[K]["result"]>;
};

const SAFE_EXTERNAL_SCHEMES = /^(https?:|tel:|mailto:|sms:)/;

/** 스캐너가 저장할 JPEG 품질. 글자를 읽기에 충분하고 웹뷰로 보내기에 가벼운 정도 */
const SCAN_QUALITY = 0.7;
const DEFAULT_MAX_PAGES = 10;

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
  async scanDocument({ maxPages }) {
    // 네이티브 모듈은 스캔할 때만 불러온다. 모듈이 없는 앱이어도 앱 시작은 막지 않는다
    const { CameraView } = await import("expo-camera");
    const { File } = await import("expo-file-system");
    // iOS는 VisionKit, Android는 ML Kit 문서 스캐너. 테두리 인식·원근 보정·여러 쪽 촬영을 기기가 처리한다
    if (!CameraView.isDocumentScannerAvailable) throw new Error("이 기기에서는 문서 스캐너를 쓸 수 없어요");
    const scanned = await CameraView.scanDocumentAsync({ quality: SCAN_QUALITY });
    if (!scanned) return { pages: [] };
    const pages: ScannedPage[] = [];
    for (const uri of scanned.pages.slice(0, maxPages ?? DEFAULT_MAX_PAGES)) {
      const base64 = await new File(uri).base64();
      pages.push({ dataUrl: `data:image/jpeg;base64,${base64}` });
    }
    return { pages };
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
