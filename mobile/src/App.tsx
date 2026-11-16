import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

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
    </SafeAreaProvider>
  );
}
