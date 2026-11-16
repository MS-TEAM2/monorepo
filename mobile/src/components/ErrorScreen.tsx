import { Pressable, StyleSheet, Text, View } from "react-native";

import { WEB_BACKGROUND } from "../config";

/** 웹을 불러오지 못했을 때(네트워크 끊김, 서버 오류) 보여 주는 화면 */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>화면을 불러오지 못했어요</Text>
      <Text style={styles.body}>네트워크 연결을 확인한 뒤 다시 시도해 주세요.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.button}>
        <Text style={styles.buttonText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: WEB_BACKGROUND,
  },
  title: { fontSize: 18, fontWeight: "600", color: "#1f1b3a" },
  body: { fontSize: 15, color: "#6b6880", textAlign: "center" },
  button: {
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#7c3aed",
  },
  buttonText: { fontSize: 15, fontWeight: "600", color: "#ffffff" },
});
