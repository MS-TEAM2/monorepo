/**
 * VisionCamera(프레임 처리 가능한 카메라)를 쓸 수 있는지.
 * 개발 빌드·스토어 빌드에는 들어 있고, Expo Go 에는 없다. 없으면 expo-camera 화면으로 대신한다.
 */
import { TurboModuleRegistry } from "react-native";

let cached: boolean | null = null;

export function hasVisionCamera(): boolean {
  if (cached !== null) return cached;
  // Expo Go 에는 Nitro 네이티브 모듈 자체가 없다. 불러오기 전에 확인해야 Nitro 가 오류 로그를 남기지 않는다
  if (TurboModuleRegistry.get("NitroModules") === null) return (cached = false);
  try {
    // Expo Go 에는 Nitro 네이티브 모듈이 없어 불러오는 순간 예외가 난다. 그래서 정적 import 대신 여기서 확인한다.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NitroModules } = require("react-native-nitro-modules") as typeof import("react-native-nitro-modules");
    cached = NitroModules.hasHybridObject("CameraFactory");
  } catch {
    cached = false;
  }
  return cached;
}
