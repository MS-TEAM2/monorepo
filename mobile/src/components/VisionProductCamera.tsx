import { Gyroscope } from "expo-sensors";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useFrameOutput,
  usePhotoOutput,
  type CameraRef,
} from "react-native-vision-camera";
import { createSynchronizable, scheduleOnRN } from "react-native-worklets";

import { NATIVE_COLORS } from "../config";
import { bytesToBase64 } from "../lib/base64";
import { finishScanner, type ScanSession } from "../lib/scanner-session";
import { createSteadyTracker, type SteadyState } from "../lib/steady-tracker";
import { detectSubject, type SubjectBox, type SubjectCheck } from "../lib/subject-detector";
import { createSubjectTracker, frameBoxToView, viewBoxToFrame, type SubjectState } from "../lib/subject-tracker";

import { Corners, RoundButton, scannerStyles as base, TorchToggle, useCameraLayout } from "./scanner-ui";

/**
 * 상품이 인식된 채로 이만큼만 흔들리지 않으면 바로 찍는다 (시간 제한 3초 대신).
 * 너무 짧으면 손이 움직이는 중에 찍혀 흐려지므로, 초점이 잡히는 시간 정도만 둔다.
 */
const HOLD_MS = 700;
const SENSOR_INTERVAL_MS = 80;
/** 프레임 분석 간격. 초당 8번 정도면 네모가 자연스럽게 따라간다 */
const ANALYZE_EVERY_MS = 120;
const FOCUS_MS = 650;
const MANUAL_FOCUS_MS = 320;
const MAX_ATTEMPTS = 3;

/**
 * VisionCamera 로 만든 상품 스캔 화면 (개발 빌드·스토어 빌드 전용. Expo Go 는 expo-camera 화면을 쓴다).
 *
 * 1) 카메라 프레임을 초당 8번 읽어 상품 위치를 찾고(subject-detector), 네모가 그 상품을 따라간다.
 * 2) 상품이 인식되고 흔들림이 잦아들면(0.7초) 바로 그 상품 위치로 실제 초점을 맞춘 뒤 찍는다.
 * 3) 프레임이 계속 어두우면 플래시를 권하고, 상품이 안 보이면 세지 않는다.
 * 상품 "이름" 인식은 찍은 사진으로 웹(나중에는 API)이 한다.
 */
export function VisionProductCamera({ session }: { session: Extract<ScanSession, { mode: "product" }> }) {
  const camera = useRef<CameraRef>(null);
  const device = useCameraDevice("back");
  const window = useWindowDimensions();
  const layout = useCameraLayout("product");

  const [started, setStarted] = useState(false);
  const [torch, setTorch] = useState(false);
  const [steady, setSteady] = useState<SteadyState>({ phase: "warming", progress: 0, interrupted: false });
  const [subject, setSubject] = useState<SubjectState>({ present: false, dark: false, box: null });
  const [nudge, setNudge] = useState(false);
  const [focusing, setFocusing] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [round, setRound] = useState(0);

  const handled = useRef(false);
  const subjectRef = useRef(subject);
  const viewBoxRef = useRef<SubjectBox | null>(null);
  const [tracker] = useState(() => createSubjectTracker());

  const [progress] = useState(() => new Animated.Value(0));
  const [lock] = useState(() => new Animated.Value(0));
  const [focus] = useState(() => new Animated.Value(0));
  const [flash] = useState(() => new Animated.Value(0));
  const [sweep] = useState(() => new Animated.Value(0));

  // 네모 자리: 상품을 못 잡으면 안내 네모, 잡으면 상품 위치
  const guide = useMemo<SubjectBox>(() => {
    const stageHeight = window.height - layout.stageTop - layout.stageBottom;
    return {
      x: (window.width - layout.frameWidth) / 2,
      y: layout.stageTop + (stageHeight - layout.frameHeight) / 2,
      width: layout.frameWidth,
      height: layout.frameHeight,
    };
  }, [layout, window]);
  const [box] = useState(() => ({
    x: new Animated.Value(guide.x),
    y: new Animated.Value(guide.y),
    width: new Animated.Value(guide.width),
    height: new Animated.Value(guide.height),
  }));

  const moveBox = useCallback(
    (target: SubjectBox, duration = 140) => {
      Animated.parallel(
        (["x", "y", "width", "height"] as const).map((key) =>
          Animated.timing(box[key], { toValue: target[key], duration, useNativeDriver: false }),
        ),
      ).start();
    },
    [box],
  );

  // ── 프레임 분석 (워클릿 스레드) ───────────────────────────────────
  /** 프레임에서 살펴볼 영역: 안내 네모를 사방으로 10% 넓힌 곳. 첫 프레임 크기를 알면 계산한다 */
  const [region] = useState(() => createSynchronizable<SubjectBox>({ x: 0, y: 0, width: 1, height: 1 }));
  const regionFor = useRef("");
  const onFrameChecked = useRef<(check: SubjectCheck, frameWidth: number, frameHeight: number) => void>(() => {});
  useEffect(() => {
    onFrameChecked.current = (check, frameWidth, frameHeight) => {
      const key = `${frameWidth}x${frameHeight}`;
      if (regionFor.current !== key) {
        regionFor.current = key;
        const padX = guide.width * 0.1;
        const padY = guide.height * 0.1;
        region.setBlocking(
          viewBoxToFrame(
            { x: guide.x - padX, y: guide.y - padY, width: guide.width + padX * 2, height: guide.height + padY * 2 },
            { width: frameWidth, height: frameHeight },
            window,
          ),
        );
      }
      const state = tracker.update(check, Date.now());
      subjectRef.current = state;
      setSubject(state);
      viewBoxRef.current = state.box
        ? keepOnScreen(frameBoxToView(state.box, { width: frameWidth, height: frameHeight }, window), window)
        : null;
    };
  }, [tracker, window, guide, region]);
  const report = useCallback((check: SubjectCheck, frameWidth: number, frameHeight: number) => {
    onFrameChecked.current(check, frameWidth, frameHeight);
  }, []);

  const [lastAnalyzedAt] = useState(() => createSynchronizable(0));
  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: "yuv",
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      "worklet";
      const now = Date.now();
      if (now - lastAnalyzedAt.getDirty() >= ANALYZE_EVERY_MS) {
        lastAnalyzedAt.setBlocking(now);
        const planes = frame.getPlanes();
        if (planes.length > 0) {
          // YUV 의 첫 평면(Y)이 밝기 값이다
          const luma = planes[0];
          const check = detectSubject(
            new Uint8Array(luma.getPixelBuffer()),
            luma.width,
            luma.height,
            luma.bytesPerRow,
            region.getDirty(),
          );
          scheduleOnRN(report, check, luma.width, luma.height);
        }
      }
      frame.dispose();
    },
  });

  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.HD_4_3,
    containerFormat: "jpeg",
    quality: 0.8,
  });

  // 상품 위치가 바뀌면 네모를 옮긴다. 초점·촬영 중에는 고정한다
  useEffect(() => {
    if (focusing || captured) return;
    moveBox(viewBoxRef.current ?? guide);
  }, [subject, guide, focusing, captured, moveBox]);

  // ── 초점 맞추기 + 촬영 ───────────────────────────────────────────
  const focusOnSubject = useCallback(async () => {
    const target = viewBoxRef.current ?? guide;
    const point = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
    try {
      // 실제 카메라 초점·노출을 상품 가운데로 맞춘다. 0.8초 안에 안 끝나면 그냥 진행한다
      await Promise.race([camera.current?.focusTo(point), new Promise((resolve) => setTimeout(resolve, 800))]);
    } catch {
      // 초점 기능이 없는 카메라도 있다
    }
  }, [guide]);

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

  const capture = async (focusMs = FOCUS_MS) => {
    if (handled.current) return;
    handled.current = true;
    setNotice(null);
    setFocusing(true);
    await Promise.all([
      focusOnSubject(),
      new Promise<void>((resolve) =>
        Animated.timing(focus, {
          toValue: 1,
          duration: focusMs,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: false,
        }).start(() => resolve()),
      ),
    ]);
    setFocusing(false);
    setCaptured(true);
    Animated.sequence([
      Animated.timing(flash, { toValue: 0.85, duration: 70, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]).start();
    try {
      const photo = await photoOutput.capturePhoto({ flashMode: "off", enableShutterSound: false }, {});
      const data = await photo.getFileDataAsync();
      const result = { width: photo.width, height: photo.height };
      photo.dispose();
      // 카메라가 잡고 있던 상품 위치도 함께 넘겨, 웹의 분석 화면이 같은 곳을 강조하게 한다
      const subject = subjectRef.current.present ? (subjectRef.current.box ?? undefined) : undefined;
      finishScanner({ status: "captured", imageBase64: bytesToBase64(new Uint8Array(data)), ...result, subject });
    } catch {
      restart("사진을 찍지 못했어요. 다시 멈춰 주세요");
    }
  };

  // ── 흔들림 측정: 상품이 인식된 채로 잠깐(HOLD_MS) 멈추면 바로 찍는다 ───
  useEffect(() => {
    if (!started) return;
    const steadyTracker = createSteadyTracker(Date.now(), { holdMs: HOLD_MS });
    let last: SteadyState["phase"] | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;
    let subscription: { remove(): void } | null = null;
    let nudgeTimer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const onSample = (rotation: { x: number; y: number; z: number }) => {
      const seen = subjectRef.current;
      const state = steadyTracker.update(rotation, Date.now(), !seen.present || seen.dark);
      setSteady(state);
      if (state.interrupted) {
        setNudge(true);
        if (nudgeTimer) clearTimeout(nudgeTimer);
        nudgeTimer = setTimeout(() => setNudge(false), 1400);
      }
      if (state.phase !== last) {
        const locked = state.phase === "steady" || state.phase === "done";
        Animated.spring(lock, { toValue: locked ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 6 }).start();
        // 상품을 잡기 시작하면 그 위치로 미리 초점을 맞춰 둔다
        if (state.phase === "steady") void focusOnSubject();
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
    // capture·focusOnSubject 는 ref 와 고정된 값만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, round]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) return;
      loop = Animated.loop(
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [sweep]);

  // ── 화면 ─────────────────────────────────────────────────────────
  const locked = steady.phase === "steady" || steady.phase === "done";
  const suggestTorch = subject.dark && !torch && Boolean(device?.hasTorch);

  const chip = captured
    ? "찍었어요"
    : focusing
      ? "초점을 맞추고 있어요"
      : nudge
        ? "움직였어요. 다시 멈춰 주세요"
        : suggestTorch
          ? "어두워서 상품이 잘 안 보여요"
          : locked
            ? "상품을 인식했어요"
            : subject.present
              ? "상품을 찾았어요. 그대로 멈춰 주세요"
              : "상품을 찾는 중이에요";
  const hint =
    notice ??
    (suggestTorch
      ? "플래시를 켜면 상품을 더 잘 찾아요"
      : (session.hint ??
        (subject.present ? "그대로 잠시만 들고 있어 주세요" : "포장 앞면이 네모 안에 크게 보이게 비춰 주세요")));

  const found = subject.present || focusing || captured;
  const cornerColor = lock.interpolate({ inputRange: [0, 1], outputRange: [NATIVE_COLORS.guide, NATIVE_COLORS.tag] });
  const shrink = focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] });
  const reticleScale = focus.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1.7, 0.92, 1] });
  const reticleOpacity = focus.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });

  if (!device) return <View style={base.black} />;

  return (
    <View style={base.black}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive
        resizeMode="cover"
        outputs={[photoOutput, frameOutput]}
        // 플래시가 없는 카메라(에뮬레이터 등)에 torchMode 를 넘기면 오류가 난다
        torchMode={device.hasTorch ? (torch ? "on" : "off") : undefined}
        onError={() => {}}
        enableNativeTapToFocusGesture
        onStarted={() => setStarted(true)}
      />
      <View style={[StyleSheet.absoluteFill, base.dim]} pointerEvents="none" />

      {/* 상품을 따라다니는 네모 */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tracker,
          { left: box.x, top: box.y, width: box.width, height: box.height, transform: [{ scale: shrink }] },
        ]}
      >
        <Corners color={found ? cornerColor : NATIVE_COLORS.guide} />
        {found ? <Animated.View style={[base.detected, { opacity: locked || focusing ? 1 : 0.5 }]} /> : null}
        {locked && !focusing && !captured ? (
          <Animated.View
            style={[
              base.sweep,
              {
                top: sweep.interpolate({ inputRange: [0, 1], outputRange: ["6%", "92%"] }),
                opacity: sweep.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
              },
            ]}
          />
        ) : null}
        {focusing || captured ? (
          <>
            <Animated.View style={[base.detected, base.detectedFocus, { opacity: reticleOpacity }]} />
            <Animated.View style={[base.reticle, { opacity: reticleOpacity, transform: [{ scale: reticleScale }] }]}>
              <View style={base.reticleDot} />
            </Animated.View>
          </>
        ) : null}
      </Animated.View>

      <View style={[styles.chipRow, { top: Math.max(layout.topBarTop + 56, guide.y - 56) }]} pointerEvents="none">
        <View style={[base.chip, (found || suggestTorch) && base.chipLocked]} accessibilityLiveRegion="polite">
          {found && !captured ? <View style={base.chipDot} /> : null}
          <Text style={[base.chipText, (found || suggestTorch) && base.chipTextLocked]}>{chip}</Text>
        </View>
      </View>

      <View
        style={[styles.progressRow, { top: guide.y + guide.height + 18, left: guide.x + 20, width: guide.width - 40 }]}
      >
        <View style={[base.progressTrack, styles.progressStatic]}>
          <Animated.View
            style={[
              base.progressFill,
              {
                transform: [
                  {
                    translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-(guide.width - 40), 0] }),
                  },
                ],
              },
            ]}
          />
        </View>
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, base.flash, { opacity: flash }]} pointerEvents="none" />

      <View style={[base.topBar, { top: layout.topBarTop }]}>
        <RoundButton label="닫기" onPress={() => finishScanner({ status: "cancelled" })}>
          <Text style={base.closeGlyph}>✕</Text>
        </RoundButton>
        {session.attempt > 1 ? (
          <Text style={base.attempt}>
            {session.attempt}/{MAX_ATTEMPTS}번째 시도
          </Text>
        ) : (
          <View />
        )}
        {device.hasTorch ? (
          <TorchToggle on={torch} suggest={suggestTorch} onToggle={() => setTorch((value) => !value)} />
        ) : (
          <View />
        )}
      </View>

      <View style={[base.sheet, { bottom: layout.sheetBottom, minHeight: layout.sheetHeight }]}>
        <Text
          style={[base.hint, layout.compact && base.hintCompact]}
          numberOfLines={2}
          accessibilityLiveRegion="polite"
        >
          {hint}
        </Text>
        <View style={base.sheetRow}>
          <View style={base.sheetSide} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="지금 찍기"
            disabled={!started || captured || focusing}
            onPress={() => void capture(MANUAL_FOCUS_MS)}
            style={({ pressed }) => [
              base.shutter,
              layout.compact && base.shutterCompact,
              pressed && base.pressed,
              (!started || captured || focusing) && base.dimmed,
            ]}
          >
            <View style={[base.shutterInner, layout.compact && base.shutterInnerCompact]} />
          </Pressable>
          <View style={[base.sheetSide, { alignItems: "flex-end" }]}>
            <Text style={base.sheetNote}>바로 찍기</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** 네모가 화면 가장자리에 붙거나 넘치지 않게 안쪽으로 당긴다 */
function keepOnScreen(box: SubjectBox, view: { width: number; height: number }, margin = 16): SubjectBox {
  const x0 = Math.max(margin, box.x);
  const y0 = Math.max(margin, box.y);
  const x1 = Math.min(view.width - margin, box.x + box.width);
  const y1 = Math.min(view.height - margin, box.y + box.height);
  return { x: x0, y: y0, width: Math.max(40, x1 - x0), height: Math.max(40, y1 - y0) };
}

const styles = StyleSheet.create({
  tracker: { position: "absolute" },
  chipRow: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  progressRow: { position: "absolute", height: 5 },
  progressStatic: { position: "relative", left: 0, right: 0, bottom: 0 },
});
