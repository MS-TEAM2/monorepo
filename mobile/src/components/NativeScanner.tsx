import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from "expo-camera";
import { Gyroscope, LightSensor } from "expo-sensors";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AccessibilityInfo, Animated, Easing, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { NATIVE_COLORS } from "../config";
import { DARK_LUX, isTooDark } from "../lib/exposure";
import { pickPictureSize } from "../lib/picture-size";
import { currentSession, finishScanner, subscribe, type ScanSession } from "../lib/scanner-session";
import { createSteadyTracker, type SteadyState } from "../lib/steady-tracker";
import { hasVisionCamera } from "../lib/vision-available";

import { Corners, RoundButton, scannerStyles, stageStyle, TorchToggle, useCameraLayout } from "./scanner-ui";

/** 이만큼 가만히 있으면 찍는다 */
const HOLD_MS = 3000;
const SENSOR_INTERVAL_MS = 80;
const BARCODE_TYPES: BarcodeType[] = ["ean13", "ean8", "upc_a", "upc_e", "code128"];
const MAX_ATTEMPTS = 3;
/** 멈춘 뒤 찍기 전에 "초점을 맞추는" 시간. 상품을 잡았다는 느낌을 준다 */
const FOCUS_MS = 650;
const MANUAL_FOCUS_MS = 320;
/** 주변이 이 시간 넘게 어두우면 안내한다 */
const DARK_HOLD_MS = 1200;

/**
 * 웹이 브리지(scanProduct·scanBarcode)로 부르는 네이티브 카메라 화면.
 * 화면은 웹이 그리는 것이 원칙이지만, 실시간 카메라는 웹뷰로 할 수 없어 이 화면만 네이티브로 둔다.
 */
export function NativeScanner() {
  const session = useSyncExternalStore(subscribe, currentSession, currentSession);

  return (
    <Modal
      visible={session !== null}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={() => finishScanner({ status: "cancelled" })}
    >
      {/* iOS 의 Modal 은 앱 화면 밖에 따로 뜨므로 안전 영역(노치·다이내믹 아일랜드)을 여기서 다시 잡는다 */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {session ? <ScannerBody key={sessionKey(session)} session={session} /> : null}
      </SafeAreaProvider>
    </Modal>
  );
}

/**
 * 개발 빌드에서는 VisionCamera 화면(실시간 상품 위치 추적)을 쓴다.
 * Expo Go 에는 그 네이티브 모듈이 없으므로, 불러오기만 해도 죽지 않게 있을 때만 require 한다.
 */
function visionCamera(): typeof import("./VisionProductCamera").VisionProductCamera | null {
  if (!hasVisionCamera()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require("./VisionProductCamera") as typeof import("./VisionProductCamera")).VisionProductCamera;
}

const VisionCamera = visionCamera();

function sessionKey(session: ScanSession) {
  return session.mode === "product" ? `product-${session.attempt}` : "barcode";
}

function ScannerBody({ session }: { session: ScanSession }) {
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  if (!permission) return <View style={scannerStyles.black} />;
  if (!permission.granted) return <PermissionDenied canAskAgain={permission.canAskAgain} onAsk={requestPermission} />;
  if (session.mode === "barcode") return <BarcodeCamera session={session} />;
  return VisionCamera ? <VisionCamera session={session} /> : <ProductCamera session={session} />;
}

/**
 * 상품 스캔(expo-camera, Expo Go 용): 자이로 센서로 흔들림을 재서, 3초 동안 가만히 있으면 초점을 맞추는 동작을 보여 준 뒤 찍는다.
 * - 안드로이드는 주변 밝기 센서로 어두우면 미리 플래시를 권한다.
 * - 찍은 사진의 EXIF 노출값이 너무 어두우면 웹으로 보내지 않고 플래시를 켠 뒤 다시 잡는다(한 번만).
 * 실제 인식(상품 위치·이름)은 웹(나중에는 API)이 한다. Expo Go 는 카메라 프레임을 읽을 수 없어서다.
 */
function ProductCamera({ session }: { session: Extract<ScanSession, { mode: "product" }> }) {
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  const [steady, setSteady] = useState<SteadyState>({ phase: "warming", progress: 0, interrupted: false });
  const [nudge, setNudge] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dark, setDark] = useState(false);
  /** 다시 잡을 때마다 올려서 흔들림 측정을 새로 시작한다 */
  const [round, setRound] = useState(0);
  const handled = useRef(false);
  const torchOn = useRef(false);
  const darkRetried = useRef(false);
  const [focus] = useState(() => new Animated.Value(0));
  const [lock] = useState(() => new Animated.Value(0));
  const [progress] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));

  const layout = useCameraLayout("product");
  const frame = layout.frameWidth;
  const frameHeight = layout.frameHeight;

  const changeTorch = (on: boolean) => {
    torchOn.current = on;
    setTorch(on);
  };

  /** 다시 상품을 잡는 상태로 되돌린다 */
  const restart = (message: string) => {
    handled.current = false;
    setCaptured(false);
    setFocusing(false);
    focus.setValue(0);
    progress.setValue(0);
    lock.setValue(0);
    setSteady({ phase: "warming", progress: 0, interrupted: false });
    setNotice(message);
    setRound((value) => value + 1);
  };

  /** 초점을 맞추는 동작(네모가 상품 쪽으로 좁혀지고 가운데 초점 표시가 맺힘)을 보여 준 뒤 찍는다 */
  const capture = async (focusMs = FOCUS_MS) => {
    if (!camera.current || handled.current) return;
    handled.current = true;
    setFocusing(true);
    setNotice(null);
    await new Promise<void>((resolve) =>
      Animated.timing(focus, {
        toValue: 1,
        duration: focusMs,
        easing: Easing.out(Easing.back(1.6)),
        // 네모 크기(lock)와 같은 노드에 곱해지므로 lock 과 같은 JS 드라이버를 쓴다
        useNativeDriver: false,
      }).start(() => resolve()),
    );
    setFocusing(false);
    setCaptured(true);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.85, duration: 70, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    try {
      const photo = await camera.current?.takePictureAsync({
        base64: true,
        quality: 0.5,
        exif: true,
        shutterSound: false,
      });
      if (!photo?.base64) throw new Error("사진 데이터가 없습니다");
      // 너무 어두우면 한 번은 플래시를 켜고 다시 잡는다. 그래도 어두우면 그대로 보낸다(웹이 다시 안내한다).
      if (!torchOn.current && !darkRetried.current && isTooDark(photo.exif)) {
        darkRetried.current = true;
        changeTorch(true);
        restart("너무 어두워서 플래시를 켰어요. 다시 멈춰 주세요");
        return;
      }
      finishScanner({ status: "captured", imageBase64: photo.base64, width: photo.width, height: photo.height });
    } catch {
      restart("사진을 찍지 못했어요. 다시 멈춰 주세요");
    }
  };

  useEffect(() => {
    if (!ready) return;
    camera.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) => setPictureSize(pickPictureSize(sizes)))
      .catch(() => {});
  }, [ready]);

  // 자이로 센서로 흔들림을 재서 3초 동안 가만히 있으면 찍는다. 센서가 없는 기기는 시간만으로 판단한다.
  useEffect(() => {
    if (!ready) return;
    const tracker = createSteadyTracker(Date.now(), { holdMs: HOLD_MS });
    let last: SteadyState["phase"] | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let subscription: { remove(): void } | null = null;
    let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const onSample = (rotation: { x: number; y: number; z: number }) => {
      const state = tracker.update(rotation, Date.now());
      setSteady(state);
      if (state.interrupted) {
        setNudge(true);
        if (nudgeTimer) clearTimeout(nudgeTimer);
        nudgeTimer = setTimeout(() => setNudge(false), 1400);
      }
      if (state.phase !== last) {
        Animated.spring(lock, {
          toValue: state.phase === "steady" || state.phase === "done" ? 1 : 0,
          useNativeDriver: false,
          speed: 18,
          bounciness: 6,
        }).start();
        last = state.phase;
      }
      progress.setValue(state.progress);
      if (state.phase === "done") void capture();
    };

    const startTimer = () => {
      if (active) fallback = setInterval(() => onSample({ x: 0, y: 0, z: 0 }), SENSOR_INTERVAL_MS);
    };

    Gyroscope.isAvailableAsync()
      .then((available) => {
        if (!active) return;
        if (!available) return startTimer();
        Gyroscope.setUpdateInterval(SENSOR_INTERVAL_MS);
        subscription = Gyroscope.addListener(onSample);
      })
      .catch(startTimer);

    return () => {
      active = false;
      subscription?.remove();
      if (fallback) clearInterval(fallback);
      if (nudgeTimer) clearTimeout(nudgeTimer);
    };
    // capture 는 ref 와 고정된 Animated 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, round]);

  // 안드로이드: 주변 밝기 센서로 어두우면 플래시를 권한다. iOS 는 센서가 없어 찍은 뒤 EXIF 로만 판단한다.
  useEffect(() => {
    let subscription: { remove(): void } | null = null;
    let active = true;
    let darkSince: number | null = null;
    LightSensor.isAvailableAsync()
      .then((available) => {
        if (!active || !available) return;
        subscription = LightSensor.addListener(({ illuminance }) => {
          const now = Date.now();
          if (illuminance < DARK_LUX) {
            darkSince ??= now;
            if (now - darkSince > DARK_HOLD_MS) setDark(true);
          } else if (illuminance > DARK_LUX * 1.5) {
            darkSince = null;
            setDark(false);
          }
        });
      })
      .catch(() => {});
    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  // 상품을 잡은 동안 네모 안을 오르내리는 스캔 빛. 움직임 줄이기 설정이면 멈춘다.
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [sweep]);

  const locked = steady.phase === "steady" || steady.phase === "done";
  const secondsLeft = Math.max(1, Math.ceil(((1 - steady.progress) * HOLD_MS) / 1000));

  const suggestTorch = dark && !torch;
  const chip = captured
    ? "찍었어요"
    : focusing
      ? "초점을 맞추고 있어요"
      : nudge
        ? "움직였어요. 다시 멈춰 주세요"
        : locked
          ? `상품을 인식하고 있어요  ${secondsLeft}`
          : suggestTorch
            ? "주변이 어두워요"
            : "상품을 네모 안에 비춰 주세요";
  const hint =
    notice ??
    (suggestTorch
      ? "플래시를 켜면 상품을 더 잘 찾아요"
      : (session.hint ??
        (locked ? "그대로 잠시만 들고 있어 주세요" : "포장 앞면이 보이게 비추고 멈추면 자동으로 찍어요")));

  const cornerColor = lock.interpolate({ inputRange: [0, 1], outputRange: [NATIVE_COLORS.guide, NATIVE_COLORS.tag] });
  const scale = Animated.multiply(
    lock.interpolate({ inputRange: [0, 1], outputRange: [1, 0.94] }),
    focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0.84] }),
  );
  const reticleScale = focus.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1.7, 0.92, 1] });
  const reticleOpacity = focus.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });

  return (
    <View style={scannerStyles.black}>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        animateShutter={false}
        pictureSize={pictureSize}
        onCameraReady={() => setReady(true)}
      />
      <View style={[StyleSheet.absoluteFill, scannerStyles.dim]} pointerEvents="none" />

      <View style={[scannerStyles.stage, stageStyle(layout)]} pointerEvents="none">
        <View style={[scannerStyles.chip, locked && scannerStyles.chipLocked]} accessibilityLiveRegion="polite">
          {locked && !captured ? <View style={scannerStyles.chipDot} /> : null}
          <Text style={[scannerStyles.chipText, locked && scannerStyles.chipTextLocked]}>{chip}</Text>
        </View>

        <Animated.View style={{ width: frame, height: frameHeight, transform: [{ scale }] }}>
          <Corners color={cornerColor} />
          {locked && !focusing && !captured ? (
            <>
              <Animated.View style={[scannerStyles.detected, { opacity: lock }]} />
              <Animated.View
                style={[
                  scannerStyles.sweep,
                  {
                    transform: [
                      { translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [12, frameHeight - 24] }) },
                    ],
                    opacity: sweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
                  },
                ]}
              />
            </>
          ) : null}
          {focusing || captured ? (
            <>
              <Animated.View
                style={[scannerStyles.detected, scannerStyles.detectedFocus, { opacity: reticleOpacity }]}
              />
              <Animated.View
                style={[scannerStyles.reticle, { opacity: reticleOpacity, transform: [{ scale: reticleScale }] }]}
              >
                <View style={scannerStyles.reticleDot} />
              </Animated.View>
            </>
          ) : null}
          <View style={scannerStyles.progressTrack}>
            <Animated.View
              style={[
                scannerStyles.progressFill,
                {
                  transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-frame, 0] }) }],
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, scannerStyles.flash, { opacity: flash }]} pointerEvents="none" />

      <View style={[scannerStyles.topBar, { top: layout.topBarTop }]}>
        <RoundButton label="닫기" onPress={() => finishScanner({ status: "cancelled" })}>
          <Text style={scannerStyles.closeGlyph}>✕</Text>
        </RoundButton>
        {session.attempt > 1 ? (
          <Text style={scannerStyles.attempt}>
            {session.attempt}/{MAX_ATTEMPTS}번째 시도
          </Text>
        ) : (
          <View />
        )}
        <TorchToggle on={torch} suggest={suggestTorch} onToggle={() => changeTorch(!torch)} />
      </View>

      <View style={[scannerStyles.sheet, { bottom: layout.sheetBottom, minHeight: layout.sheetHeight }]}>
        <Text
          style={[scannerStyles.hint, layout.compact && scannerStyles.hintCompact]}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {hint}
        </Text>
        <View style={scannerStyles.sheetRow}>
          <View style={scannerStyles.sheetSide} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지금 찍기"
            disabled={!ready || captured || focusing}
            onPress={() => void capture(MANUAL_FOCUS_MS)}
            style={({ pressed }) => [
              scannerStyles.shutter,
              layout.compact && scannerStyles.shutterCompact,
              pressed && scannerStyles.pressed,
              (!ready || captured || focusing) && scannerStyles.dimmed,
            ]}
          >
            <View style={[scannerStyles.shutterInner, layout.compact && scannerStyles.shutterInnerCompact]} />
          </Pressable>
          <View style={[scannerStyles.sheetSide, { alignItems: "flex-end" }]}>
            <Text style={scannerStyles.sheetNote}>바로 찍기</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function BarcodeCamera({ session }: { session: Extract<ScanSession, { mode: "barcode" }> }) {
  const layout = useCameraLayout("barcode");
  const [torch, setTorch] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const handled = useRef(false);
  const [sweep] = useState(() => new Animated.Value(0));
  const frame = layout.frameWidth;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced) loop.start();
    });
    return () => loop.stop();
  }, [sweep]);

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (handled.current) return;
    handled.current = true;
    setFound(result.data);
    // 읽힌 번호를 잠깐 보여 준 뒤 돌려준다
    setTimeout(() => finishScanner({ status: "scanned", code: result.data, format: result.type }), 450);
  };

  return (
    <View style={scannerStyles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <View style={[StyleSheet.absoluteFill, scannerStyles.dim]} pointerEvents="none" />
      <View style={[scannerStyles.stage, stageStyle(layout)]} pointerEvents="none">
        <View style={[scannerStyles.chip, found !== null && scannerStyles.chipLocked]}>
          <Text style={[scannerStyles.chipText, found !== null && scannerStyles.chipTextLocked]}>
            {found ? `읽었어요  ${found}` : (session.hint ?? "바코드를 가로로 맞춰 주세요")}
          </Text>
        </View>
        <View style={{ width: frame, height: layout.frameHeight }}>
          <Corners color={found ? NATIVE_COLORS.tag : NATIVE_COLORS.guide} />
          <Animated.View
            style={[
              scannerStyles.barcodeLine,
              { transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [16, frame - 18] }) }] },
            ]}
          />
        </View>
      </View>

      <View style={[scannerStyles.topBar, { top: layout.topBarTop }]}>
        <RoundButton label="닫기" onPress={() => finishScanner({ status: "cancelled" })}>
          <Text style={scannerStyles.closeGlyph}>✕</Text>
        </RoundButton>
        <View />
        <TorchToggle on={torch} onToggle={() => setTorch((value) => !value)} />
      </View>
      <View style={[scannerStyles.sheet, { bottom: layout.sheetBottom, minHeight: layout.sheetHeight }]}>
        <Text style={[scannerStyles.hint, layout.compact && scannerStyles.hintCompact]}>
          포장 뒷면의 바코드를 비추면 바로 읽어요
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => finishScanner({ status: "cancelled" })}
          style={({ pressed }) => [scannerStyles.secondary, pressed && scannerStyles.pressed]}
        >
          <Text style={scannerStyles.secondaryText}>번호로 직접 입력하기</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PermissionDenied({ canAskAgain, onAsk }: { canAskAgain: boolean; onAsk: () => void }) {
  return (
    <SafeAreaView style={scannerStyles.permission} edges={["top", "bottom"]}>
      <Text style={scannerStyles.permissionTitle}>카메라를 허용해 주세요</Text>
      <Text style={scannerStyles.permissionBody}>상품과 바코드를 비춰야 가격을 비교할 수 있어요.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => (canAskAgain ? onAsk() : void Linking.openSettings())}
        style={({ pressed }) => [scannerStyles.primary, pressed && scannerStyles.pressed]}
      >
        <Text style={scannerStyles.primaryLabel}>{canAskAgain ? "카메라 허용하기" : "설정에서 허용하기"}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => finishScanner({ status: "cancelled" })}
        style={({ pressed }) => [scannerStyles.secondaryLight, pressed && scannerStyles.pressed]}
      >
        <Text style={scannerStyles.secondaryLightText}>나중에 하기</Text>
      </Pressable>
    </SafeAreaView>
  );
}
