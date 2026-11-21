/**
 * 카메라 화면 배치를 기기 크기와 안전 영역(노치·다이내믹 아일랜드·홈 바)으로 계산한다. RN 에 의존하지 않는다 (vitest).
 *
 * 위에서부터: [안전 영역] [상단 버튼 줄] [안내 칩 + 뷰파인더 + 진행 막대] [아래 시트] [안전 영역]
 * 뷰파인더는 남는 높이 안에서만 커지므로 작은 기기(iPhone SE 등)에서도 버튼과 겹치거나 잘리지 않는다.
 */

export type Insets = { top: number; bottom: number; left: number; right: number };

export const TOP_BAR_HEIGHT = 44;
const TOP_BAR_GAP = 8;
const CHIP_BLOCK = 40 + 14;
const PROGRESS_BLOCK = 30;
const SIDE_GAP = 16;

export type CameraLayout = {
  /** 상단 버튼 줄의 top */
  topBarTop: number;
  /** 아래 시트의 bottom 여백 */
  sheetBottom: number;
  /** 아래 시트 높이 (안내 문구 + 셔터) */
  sheetHeight: number;
  /** 뷰파인더 영역(칩 포함)의 top·bottom */
  stageTop: number;
  stageBottom: number;
  frameWidth: number;
  frameHeight: number;
  /** 화면이 낮아 시트를 줄인 상태 (셔터 작게, 안내 한 줄) */
  compact: boolean;
};

export function cameraLayout(
  window: { width: number; height: number },
  insets: Insets,
  mode: "product" | "barcode",
): CameraLayout {
  // 상태 표시줄이 안전 영역에 안 잡히는 기기(안드로이드 일부)도 있어 최소 여백을 둔다
  const top = Math.max(insets.top, 24);
  const bottom = Math.max(insets.bottom, 12);
  const usable = window.height - top - bottom;
  const compact = usable < 640;

  const sheetHeight = mode === "product" ? (compact ? 132 : 162) : compact ? 112 : 126;
  const topBarTop = top + TOP_BAR_GAP;
  const stageTop = topBarTop + TOP_BAR_HEIGHT + SIDE_GAP;
  const stageBottom = bottom + sheetHeight + SIDE_GAP;
  const stageHeight = window.height - stageTop - stageBottom;

  const maxWidth = Math.min(window.width - insets.left - insets.right - 64, 330);
  const room = Math.max(120, stageHeight - CHIP_BLOCK - PROGRESS_BLOCK);
  const ideal = mode === "product" ? maxWidth * 1.15 : maxWidth * 0.5;
  const frameHeight = Math.round(Math.min(ideal, room));
  // 높이가 모자라면 폭도 줄여 비율을 지킨다 (상품은 세로로 조금 긴 네모)
  const frameWidth = Math.round(mode === "product" ? Math.min(maxWidth, frameHeight / 1.05) : maxWidth);

  return { topBarTop, sheetBottom: bottom, sheetHeight, stageTop, stageBottom, frameWidth, frameHeight, compact };
}
