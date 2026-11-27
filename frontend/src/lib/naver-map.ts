/**
 * 네이버지도 JS v3 로더와 이 앱이 쓰는 최소 타입.
 * Client ID 는 브라우저에 노출되는 값이라 NEXT_PUBLIC_NAVER_MAP_CLIENT_ID 로 받고, NCP 콘솔에 웹 서비스 URL 을 등록해 제한한다.
 * Client Secret 은 웹에 두지 않는다. 타입 패키지는 새 의존성이라 쓰지 않고 필요한 것만 적었다.
 */

export type NLatLng = { lat(): number; lng(): number };
export type NPoint = { x: number; y: number };

export type NMap = {
  setCenter(center: NLatLng): void;
  /** 부드럽게 옮긴다 */
  panTo(center: NLatLng): void;
  getCenter(): NLatLng;
  setZoom(zoom: number, effect?: boolean): void;
  getZoom(): number;
  morph(coord: NLatLng, zoom?: number): void;
  getProjection(): { fromCoordToOffset(coord: NLatLng): NPoint };
  destroy(): void;
};

export type NOverlay = { setMap(map: NMap | null): void };
export type NCircle = NOverlay & { setCenter(center: NLatLng): void; setRadius(radius: number): void };
export type NMarker = NOverlay & { setPosition(position: NLatLng): void };
export type NListener = object;

export type NaverMapsNS = {
  LatLng: new (lat: number, lng: number) => NLatLng;
  Point: new (x: number, y: number) => NPoint;
  Map: new (
    element: HTMLElement,
    options: { center: NLatLng; zoom: number; zoomControl?: boolean; scaleControl?: boolean; mapDataControl?: boolean },
  ) => NMap;
  Marker: new (options: {
    position: NLatLng;
    map: NMap;
    icon?: { content: string; anchor: NPoint };
    title?: string;
    zIndex?: number;
    clickable?: boolean;
  }) => NMarker;
  Circle: new (options: {
    map: NMap;
    center: NLatLng;
    radius: number;
    strokeColor: string;
    strokeOpacity: number;
    strokeWeight: number;
    strokeStyle: string;
    fillColor: string;
    fillOpacity: number;
    clickable?: boolean;
  }) => NCircle;
  Event: {
    addListener(target: object, name: string, handler: (event: { coord?: NLatLng }) => void): NListener;
    removeListener(listener: NListener): void;
  };
};

declare global {
  interface Window {
    naver?: { maps: NaverMapsNS };
    /** 네이버지도가 Client ID 인증에 실패하면 부르는 함수 (등록하지 않은 웹 서비스 URL 등) */
    navermap_authFailure?: () => void;
  }
}

type FailureListener = () => void;
const authFailureListeners = new Set<FailureListener>();

/** 인증 실패를 알림받는다. 해제 함수를 돌려준다 */
export function onNaverAuthFailure(listener: FailureListener): () => void {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

export function naverMapClientId(): string | null {
  return process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID || null;
}

let loading: Promise<NaverMapsNS> | null = null;

/** 스크립트를 한 번만 넣고 네이버지도 객체를 돌려준다. 실패하면 다음 호출에서 다시 시도한다 */
export function loadNaverMaps(clientId: string): Promise<NaverMapsNS> {
  if (typeof window === "undefined") return Promise.reject(new Error("브라우저에서만 쓸 수 있습니다"));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  window.navermap_authFailure = () => authFailureListeners.forEach((listener) => listener());
  loading ??= new Promise<NaverMapsNS>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.onload = () => (window.naver?.maps ? resolve(window.naver.maps) : reject(new Error("네이버지도 로드 실패")));
    script.onerror = () => reject(new Error("네이버지도 로드 실패"));
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

/** 지도 객체에 넘길 색. 컴포넌트에 색을 직접 쓰지 않도록 globals.css 토큰을 읽는다 */
export function cssToken(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
