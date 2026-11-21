import {
  APP_USER_AGENT_NAME,
  BRIDGE_VERSION,
  parseWebToAppMessage,
  toInjectedAppInfo,
  toInjectedResponse,
} from "@ax/bridge";
import { type ComponentRef, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Platform } from "react-native";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";

import { appVersion, WEB_BACKGROUND } from "../config";
import { handleBridgeMessage } from "../lib/bridge-handler";
import { shouldOpenInWebView } from "../lib/url-policy";
import { ErrorScreen } from "./ErrorScreen";

const injectedAppInfo = toInjectedAppInfo({
  platform: Platform.OS === "ios" ? "ios" : "android",
  appVersion,
  bridgeVersion: BRIDGE_VERSION,
});

export function WebShell({ url }: { url: string }) {
  const webView = useRef<ComponentRef<typeof WebView>>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);

  // 안드로이드 뒤로 가기: 웹 페이지 기록이 있으면 웹에서 뒤로, 없으면 앱 종료(기본 동작)
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      webView.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const onNavigationStateChange = (state: WebViewNavigation) => {
    canGoBack.current = state.canGoBack;
  };

  // 우리 웹이 아닌 주소는 웹뷰 밖(기본 브라우저·전화·메일 앱)으로 연다
  const onShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
    if (shouldOpenInWebView(request.url, url)) return true;
    Linking.openURL(request.url).catch(() => {});
    return false;
  };

  const onMessage = async (event: WebViewMessageEvent) => {
    const message = parseWebToAppMessage(event.nativeEvent.data);
    if (!message) return;
    const response = await handleBridgeMessage(message);
    webView.current?.injectJavaScript(toInjectedResponse(response));
  };

  // 다시 시도하면 WebView 를 새로 만들어 처음부터 불러온다
  if (failed) return <ErrorScreen onRetry={() => setFailed(false)} />;

  return (
    <WebView
      ref={webView}
      source={{ uri: url }}
      style={{ flex: 1, backgroundColor: WEB_BACKGROUND }}
      applicationNameForUserAgent={`${APP_USER_AGENT_NAME}/${appVersion}`}
      injectedJavaScriptBeforeContentLoaded={injectedAppInfo}
      onMessage={onMessage}
      onNavigationStateChange={onNavigationStateChange}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onError={() => setFailed(true)}
      // 웹 화면을 앱처럼: 확대·늘어나는 스크롤 끄기, 당겨서 새로고침
      allowsBackForwardNavigationGestures
      pullToRefreshEnabled
      bounces={false}
      setBuiltInZoomControls={false}
      overScrollMode="never"
      // <input type="file"> 업로드는 기본으로 된다. 웹 페이지가 기기 파일을 직접 읽는 것은 막는다.
      allowFileAccess={false}
      // 동영상을 전체 화면으로 강제하지 않고 페이지 안에서 재생
      mediaPlaybackRequiresUserAction={false}
      allowsInlineMediaPlayback
      // 로그인 쿠키를 앱 재시작 후에도 유지
      sharedCookiesEnabled
      thirdPartyCookiesEnabled={false}
      originWhitelist={["https://*", "http://*"]}
      // 개발 중에만 크롬 DevTools(chrome://inspect)로 웹뷰를 볼 수 있게 한다
      webviewDebuggingEnabled={__DEV__}
    />
  );
}
