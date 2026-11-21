import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { NativeScanner } from "./components/NativeScanner";
import { WebShell } from "./components/WebShell";
import { WEB_BACKGROUND, webUrl } from "./config";

export default function App() {
  return (
    <SafeAreaProvider>
      {/* 노치·홈 바 영역은 앱이 비워 두고 웹은 그 안쪽만 그린다. 배경색은 웹의 --background 와 맞춘다. */}
      <SafeAreaView style={{ flex: 1, backgroundColor: WEB_BACKGROUND }} edges={["top", "bottom"]}>
        <StatusBar style="dark" />
        <WebShell url={webUrl} />
      </SafeAreaView>
      {/* 웹이 브리지로 카메라를 요청하면 웹뷰 위에 전체 화면으로 뜬다 */}
      <NativeScanner />
    </SafeAreaProvider>
  );
}
