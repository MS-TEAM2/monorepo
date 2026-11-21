import { Animated, Pressable, StyleSheet, Text, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NATIVE_COLORS } from "../config";
import { cameraLayout, type CameraLayout } from "../lib/camera-layout";

/** 카메라 화면(expo-camera·VisionCamera)이 함께 쓰는 배치·버튼·스타일 */

export /** 기기 크기와 안전 영역으로 카메라 화면 배치를 계산한다 (src/lib/camera-layout.ts) */
function useCameraLayout(mode: "product" | "barcode"): CameraLayout {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return cameraLayout(window, insets, mode);
}

export function stageStyle(layout: CameraLayout) {
  return { top: layout.stageTop, bottom: layout.stageBottom };
}

export /** 둥근 모서리 네 개. 상품을 잡으면 노란색으로 바뀐다 */
function Corners({ color }: { color: Animated.AnimatedInterpolation<string> | string }) {
  const base = { position: "absolute" as const, width: 34, height: 34, borderColor: color };
  return (
    <>
      <Animated.View
        style={[base, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 }]}
      />
      <Animated.View
        style={[base, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 }]}
      />
      <Animated.View
        style={[base, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 }]}
      />
      <Animated.View
        style={[base, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 18 }]}
      />
    </>
  );
}

export function TorchToggle({
  on,
  suggest = false,
  onToggle,
}: {
  on: boolean;
  suggest?: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel="플래시"
      onPress={onToggle}
      style={({ pressed }) => [
        scannerStyles.pill,
        on && scannerStyles.pillOn,
        suggest && scannerStyles.pillSuggest,
        pressed && scannerStyles.pressed,
      ]}
    >
      <Text style={[scannerStyles.pillText, (on || suggest) && scannerStyles.pillTextOn]}>
        {suggest ? "플래시 켜기" : `플래시 ${on ? "켜짐" : "꺼짐"}`}
      </Text>
    </Pressable>
  );
}

export function RoundButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [scannerStyles.round, pressed && scannerStyles.pressed]}
    >
      {children}
    </Pressable>
  );
}

export const scannerStyles = StyleSheet.create({
  black: { flex: 1, backgroundColor: "#000" },
  dim: { backgroundColor: NATIVE_COLORS.cameraDim },
  stage: { position: "absolute", left: 0, right: 0, alignItems: "center", justifyContent: "center", gap: 14 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: NATIVE_COLORS.glass,
  },
  chipLocked: { backgroundColor: NATIVE_COLORS.tag },
  chipDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NATIVE_COLORS.ink },
  chipText: { color: NATIVE_COLORS.white, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  chipTextLocked: { color: NATIVE_COLORS.ink },
  detected: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    bottom: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: NATIVE_COLORS.tagSoft,
    backgroundColor: NATIVE_COLORS.tagWash,
  },
  detectedFocus: { borderColor: NATIVE_COLORS.tag, borderWidth: 3, backgroundColor: "transparent" },
  reticle: {
    position: "absolute",
    alignSelf: "center",
    top: "50%",
    marginTop: -36,
    width: 72,
    height: 72,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: NATIVE_COLORS.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  reticleDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: NATIVE_COLORS.tag },
  sweep: {
    position: "absolute",
    left: 20,
    right: 20,
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: NATIVE_COLORS.tag,
  },
  progressTrack: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: -22,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: NATIVE_COLORS.glass,
  },
  progressFill: { ...StyleSheet.absoluteFill, borderRadius: 3, backgroundColor: NATIVE_COLORS.tag },
  barcodeLine: {
    position: "absolute",
    top: 14,
    bottom: 14,
    left: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: NATIVE_COLORS.tag,
  },
  flash: { backgroundColor: NATIVE_COLORS.white },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: NATIVE_COLORS.glass,
  },
  closeGlyph: { color: NATIVE_COLORS.white, fontSize: 18, fontWeight: "700" },
  attempt: { color: NATIVE_COLORS.white, fontSize: 15, fontWeight: "700" },
  pill: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: NATIVE_COLORS.glass,
  },
  pillOn: { backgroundColor: NATIVE_COLORS.white },
  pillSuggest: { backgroundColor: NATIVE_COLORS.tag },
  pillText: { color: NATIVE_COLORS.white, fontSize: 14, fontWeight: "700" },
  pillTextOn: { color: NATIVE_COLORS.ink },
  sheet: {
    position: "absolute",
    left: 12,
    right: 12,
    justifyContent: "center",
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: NATIVE_COLORS.sheet,
    alignItems: "center",
    gap: 14,
  },
  hint: { color: NATIVE_COLORS.white, fontSize: 16, fontWeight: "600", textAlign: "center", lineHeight: 23 },
  hintCompact: { fontSize: 15, lineHeight: 20 },
  sheetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  sheetSide: { width: 88 },
  sheetNote: { color: NATIVE_COLORS.muted, fontSize: 13, fontWeight: "600" },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: NATIVE_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: NATIVE_COLORS.white },
  shutterCompact: { width: 60, height: 60, borderRadius: 30 },
  shutterInnerCompact: { width: 46, height: 46, borderRadius: 23 },
  secondary: {
    minHeight: 48,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: NATIVE_COLORS.glass,
  },
  secondaryText: { color: NATIVE_COLORS.white, fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.7 },
  dimmed: { opacity: 0.45 },
  permission: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
    backgroundColor: NATIVE_COLORS.shelf,
  },
  permissionTitle: { fontSize: 21, fontWeight: "800", color: NATIVE_COLORS.ink, textAlign: "center" },
  permissionBody: { fontSize: 16, color: NATIVE_COLORS.inkSoft, textAlign: "center" },
  primary: {
    marginTop: 8,
    minHeight: 52,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: NATIVE_COLORS.ink,
  },
  primaryLabel: { fontSize: 16, fontWeight: "700", color: NATIVE_COLORS.white },
  secondaryLight: { minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  secondaryLightText: { fontSize: 16, fontWeight: "700", color: NATIVE_COLORS.inkSoft },
});
