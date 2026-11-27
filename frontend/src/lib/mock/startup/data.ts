/**
 * 화면 시안(SCRUM-191)의 예시 데이터. 실제 수치가 아니며 API가 연결되면 지운다.
 * 체크리스트·지원정책 문구는 공식 원문 대조 전이다 (Notion 기획서 S12).
 */
import type {
  BusinessType,
  BusinessTypeId,
  Category,
  ChecklistGroup,
  ChecklistItem,
  ConditionKey,
  ContractField,
  FormState,
  Neighborhood,
  Point,
  Policy,
  PolicyCategory,
  RadiusM,
  RiskClause,
} from "@/lib/mock/startup/types";

export const META = {
  licenseDate: "2026-10-31",
  commercialQuarter: "2026Q2",
  modelVersionLocal: "MOCK",
  modelVersionApiDefault: "km_baseline",
} as const;

export const CATEGORIES: readonly Category[] = [
  {
    id: "korean",
    label: "한식",
    baseline3y: 53.4,
    avgSalesBase: 3043,
    openRateBase: 3.2,
    closeRateBase: 1.9,
    franchiseBase: 18.2,
    areaRec: [66, 132, "홀 회전이 중요한 식사 업종"] as const,
  },
  {
    id: "chinese",
    label: "중식",
    baseline3y: 56.1,
    avgSalesBase: 3820,
    openRateBase: 2.4,
    closeRateBase: 2.3,
    franchiseBase: 14.5,
    areaRec: [66, 132, "홀과 배달 주방 병행 비중 높음"] as const,
  },
  {
    id: "japanese",
    label: "일식",
    baseline3y: 51.2,
    avgSalesBase: 3680,
    openRateBase: 3.8,
    closeRateBase: 3.4,
    franchiseBase: 22.1,
    areaRec: [50, 99, "바 좌석 위주 소형 운영 가능"] as const,
  },
  {
    id: "western",
    label: "양식",
    baseline3y: 48.6,
    avgSalesBase: 3950,
    openRateBase: 4.5,
    closeRateBase: 4.1,
    franchiseBase: 16.4,
    areaRec: [50, 99, "좌석 수보다 테이블 회전율 핵심"] as const,
  },
  {
    id: "bakery",
    label: "제과점",
    baseline3y: 58.9,
    avgSalesBase: 3480,
    openRateBase: 2.9,
    closeRateBase: 2.5,
    franchiseBase: 38.6,
    areaRec: [33, 66, "생산 주방 비중이 큰 구조"] as const,
  },
  {
    id: "fastfood",
    label: "패스트푸드",
    baseline3y: 54.7,
    avgSalesBase: 3590,
    openRateBase: 3.6,
    closeRateBase: 3.2,
    franchiseBase: 61.4,
    areaRec: [50, 99, "포장·배달 위주 시 소형화 유리"] as const,
  },
  {
    id: "snack",
    label: "분식",
    baseline3y: 50.8,
    avgSalesBase: 2740,
    openRateBase: 3.7,
    closeRateBase: 3.6,
    franchiseBase: 27.8,
    areaRec: [26, 50, "포장·배달 중심 소형 매장 다수"] as const,
  },
  {
    id: "pub_chicken",
    label: "호프·치킨",
    baseline3y: 47.9,
    avgSalesBase: 3120,
    openRateBase: 4.1,
    closeRateBase: 4.3,
    franchiseBase: 52.3,
    areaRec: [50, 99, "저녁 홀 영업 여부에 따라 편차"] as const,
  },
  {
    id: "cafe",
    label: "카페",
    baseline3y: 51.8,
    avgSalesBase: 2680,
    openRateBase: 5.2,
    closeRateBase: 4.4,
    franchiseBase: 31.5,
    areaRec: [33, 66, "테이크아웃 중심 33㎡ 이하 다수"] as const,
  },
];

export const TIME_SLOTS = ["00-06", "06-11", "11-14", "14-17", "17-21", "21-24"] as const;

export const NEIGHBORHOODS: readonly Neighborhood[] = [
  {
    dongCode: "11440565",
    name: "마포 공덕동",
    gu: "마포구",
    shortName: "공덕동",
    addr: "서울 마포구 공덕동 253-42",
    tag: "쿼드러플 역세권 · 오피스·주거 복합",
    lat: 37.5441,
    lng: 126.9515,
    floatingPopDaily: 124600,
    timeDist: [5, 19, 25, 16, 24, 11],
    salesMultiplier: 1,
    densityFactor: 0.96,
    turnoverAdj: -0.2,
    similarStoreBase: 158,
    mapStyle: {
      riverPath: "M -20 430 Q 280 395 820 425",
      parkPolys: ["520,40 730,30 740,170 545,165", "60,40 180,40 175,115 60,115"],
      mainRoadA: "M 0 360 L 800 130",
      mainRoadB: "M 140 500 L 660 -10",
      landmark: "공덕역 오거리 · 효창공원",
      station: {
        name: "공덕역 (5·6·경의·공항)",
        x: 375,
        y: 270,
      },
    },
  },
  {
    dongCode: "11440710",
    name: "마포 연남동",
    gu: "마포구",
    shortName: "연남동",
    addr: "서울 마포구 연남동 228-14",
    tag: "경의선 숲길 · 트렌드 외식 상권",
    lat: 37.5616,
    lng: 126.9248,
    floatingPopDaily: 98400,
    timeDist: [7, 11, 18, 22, 28, 14],
    salesMultiplier: 1.08,
    densityFactor: 1.18,
    turnoverAdj: 0.6,
    similarStoreBase: 214,
    mapStyle: {
      riverPath: "M -20 415 Q 220 365 440 400 T 820 355",
      parkPolys: ["60,250 420,175 445,205 85,285", "580,55 745,55 745,145 600,152"],
      mainRoadA: "M 0 215 L 800 165",
      mainRoadB: "M 365 0 L 445 500",
      landmark: "경의선 숲길",
      station: {
        name: "홍대입구역 3번출구",
        x: 390,
        y: 265,
      },
    },
  },
  {
    dongCode: "11200650",
    name: "성동 성수1가",
    gu: "성동구",
    shortName: "성수1가",
    addr: "서울 성동구 성수동1가 656-12",
    tag: "서울숲 · 팝업 · F&B 핫플레이스",
    lat: 37.5446,
    lng: 127.0439,
    floatingPopDaily: 112800,
    timeDist: [5, 12, 21, 25, 27, 10],
    salesMultiplier: 1.18,
    densityFactor: 1.1,
    turnoverAdj: 0.5,
    similarStoreBase: 196,
    mapStyle: {
      riverPath: "M -20 390 Q 240 455 480 410 T 820 440",
      parkPolys: ["35,30 245,30 225,195 35,180", "615,240 755,240 755,340 615,340"],
      mainRoadA: "M 0 270 L 800 220",
      mainRoadB: "M 435 0 L 370 500",
      landmark: "서울숲길 · 뚝섬역",
      station: {
        name: "뚝섬역 (2호선)",
        x: 425,
        y: 255,
      },
    },
  },
  {
    dongCode: "11680640",
    name: "강남 역삼1동",
    gu: "강남구",
    shortName: "역삼1동",
    addr: "서울 강남구 역삼동 736-10",
    tag: "테헤란로 · 초대형 오피스 밀집",
    lat: 37.5007,
    lng: 127.0365,
    floatingPopDaily: 176500,
    timeDist: [6, 17, 29, 18, 22, 8],
    salesMultiplier: 1.29,
    densityFactor: 1.32,
    turnoverAdj: 0.9,
    similarStoreBase: 318,
    mapStyle: {
      riverPath: "M -20 475 L 820 475",
      parkPolys: ["600,45 740,45 740,130 600,130", "70,340 190,340 190,425 70,425"],
      mainRoadA: "M 0 240 L 800 240",
      mainRoadB: "M 360 0 L 360 500",
      landmark: "테헤란로 · 역삼역",
      station: {
        name: "역삼역 (2호선)",
        x: 360,
        y: 240,
      },
    },
  },
  {
    dongCode: "11740650",
    name: "강동 성내2동",
    gu: "강동구",
    shortName: "성내2동",
    addr: "서울 강동구 성내동 112-8",
    tag: "주거밀착 · 생활형 골목상권",
    lat: 37.5305,
    lng: 127.1292,
    floatingPopDaily: 68900,
    timeDist: [8, 14, 17, 19, 29, 13],
    salesMultiplier: 0.87,
    densityFactor: 0.72,
    turnoverAdj: -0.6,
    similarStoreBase: 112,
    mapStyle: {
      riverPath: "M -20 85 Q 230 50 450 100 T 820 65",
      parkPolys: ["555,315 745,315 745,445 555,445"],
      mainRoadA: "M 0 280 L 800 255",
      mainRoadB: "M 385 0 L 415 500",
      landmark: "성안로 · 강동구청역",
      station: {
        name: "강동구청역 (8호선)",
        x: 398,
        y: 268,
      },
    },
  },
  {
    dongCode: "11440660",
    name: "마포 서교동",
    gu: "마포구",
    shortName: "서교동",
    addr: "서울 마포구 서교동 358-22",
    tag: "홍대입구 · 야간·주말 고밀도",
    lat: 37.5553,
    lng: 126.9219,
    floatingPopDaily: 158200,
    timeDist: [11, 9, 16, 20, 27, 17],
    salesMultiplier: 1.16,
    densityFactor: 1.38,
    turnoverAdj: 1.2,
    similarStoreBase: 289,
    mapStyle: {
      riverPath: "M -20 440 Q 280 405 560 445 T 820 405",
      parkPolys: ["45,65 170,65 170,150 45,150", "610,195 745,195 745,295 610,295"],
      mainRoadA: "M 0 250 L 800 205",
      mainRoadB: "M 410 0 L 350 500",
      landmark: "양화로 · 어울마당로",
      station: {
        name: "합정·홍대 상권",
        x: 382,
        y: 230,
      },
    },
  },
];

export const STORE_NAMES: Record<string, readonly string[]> = {
  korean: [
    "바른한상",
    "정성가마솥",
    "골목국밥",
    "온기반상",
    "서울집밥",
    "마루청국장",
    "담백순대국",
    "소반한식",
    "큰손김치찜",
    "다정백반",
  ],
  chinese: [
    "만리향",
    "금룡반점",
    "화원마라",
    "홍콩면가",
    "북경루",
    "차이나키친",
    "소룡포하우스",
    "명가짬뽕",
    "대성각",
    "청화반점",
  ],
  japanese: [
    "하루라멘",
    "모리돈카츠",
    "소바공방",
    "텐동하루",
    "유키규동",
    "아키라키친",
    "카츠상회",
    "오사카카레",
    "마츠야우동",
    "사쿠라정식",
  ],
  western: [
    "비스트로온",
    "파스타랩",
    "테이블포유",
    "오스테리아",
    "브런치워크",
    "리틀피제리아",
    "그릴하우스",
    "아틀리에키친",
    "선데이파스타",
    "트러플테이블",
  ],
  bakery: [
    "밀향제과",
    "오전베이커리",
    "버터크러스트",
    "소금빵공방",
    "브레드모닝",
    "바게트룸",
    "르방하우스",
    "달콤파티세리",
    "호밀상회",
    "크루아상랩",
  ],
  fastfood: [
    "버거팩토리",
    "크리스피버거",
    "스매시하우스",
    "그릴드샌드",
    "치즈번",
    "어반버거",
    "데일리토스트",
    "프레시랩",
    "골든패티",
    "하이버거",
  ],
  snack: [
    "즉석떡볶이방",
    "고봉김밥",
    "골목분식",
    "꼬마김밥집",
    "매콤신당분식",
    "오뎅바른집",
    "튀김공작소",
    "쫄면연구소",
    "시장손만두",
    "한끼분식",
  ],
  pub_chicken: [
    "바삭치킨펍",
    "노을호프",
    "오븐구이통닭",
    "크래프트비어바",
    "옛날가마솥치킨",
    "골목맥주집",
    "하이볼클럽",
    "수제맥주창고",
    "불금치킨",
    "야간비어",
  ],
  cafe: [
    "로스터리온",
    "오후의원두",
    "브루잉스튜디오",
    "모퉁이커피",
    "솔트크림카페",
    "에스프레소바",
    "필터커피랩",
    "햇살다방",
    "원두상회",
    "드립하우스",
  ],
};

export const EXAMPLE_FORM: Partial<FormState> = {
  depositMan: "5000",
  rentMan: "250",
  maintenanceMan: "30",
  rentVatSeparate: false,
  laborMan: "300",
  otherFixedMan: "120",
  variableCostRate: "40",
  expectedSalesMan: "1650",
};

export const MAP_SIZE = {
  width: 800,
  height: 500,
} as const;

export const CONTRACT_STEPS: readonly string[] = [
  "1. 계약서 파일 업로드",
  "2. 글자 인식 (OCR 추출)",
  "3. 개인정보 마스킹 처리",
  "4. 핵심 조건 · 위험 특약 분석",
  "5. 원본 파일 및 OCR 보관분 즉시 삭제",
];

export const RISK_CLAUSES: readonly RiskClause[] = [
  {
    id: "R01",
    severity: "high",
    title: "중도해지 위약금 부담 과다",
    source: "임차인 사정으로 해지 시 잔여 기간 차임 전액을 위약금으로 지급한다",
    reason: "1년 차에 중도 종료하더라도 남은 계약 기간 월세를 전액 부담해야 해 손실 규모가 급격히 커집니다.",
    law: "상가임대차보호법 및 민법 손해배상액 예정 관련 조항 검토 필요 (법률 자문 아님)",
    checkPoint: "신규 임차인을 주선하면 위약금이 면제되거나 월세 2~3개월분으로 상한 조정 가능한지",
    question: "새 임차인을 주선하면 위약금 없이 해지할 수 있나요? 위약금 상한을 월세 몇 개월분으로 협의할 수 있나요?",
  },
  {
    id: "R02",
    severity: "high",
    title: "원상복구 범위 모호 (공실 철거 부담)",
    source: "임차인은 퇴거 시 공실 상태로 원상복구한다",
    reason:
      "입점 전 기존 임차인이 설치한 시설물까지 철거 비용을 떠안을 수 있으며, 철거 금액 상한이 기재되지 않았습니다.",
    law: "임대차 종료 시 원상회복 의무 범위 판례 기준 확인 필요 (법률 자문 아님)",
    checkPoint: "입점 당시 상태 기준인지, 전 임차인 시설물 포함 여부 및 현황 사진 첨부 가능 여부",
    question: '원상복구 기준을 "입점 당시 상태"로 명시하고 현장 사진을 특약에 첨부할 수 있나요?',
  },
  {
    id: "R03",
    severity: "high",
    title: "연간 월세 인상률 상한 확인 필요",
    source: "임차인은 매년 차임을 7% 인상하는 데 동의한다",
    reason:
      "매년 7% 복리 인상 시 3년 차 월세가 초기 대비 14.5% 상승합니다. 환산보증금 기준에 따라 법정 증액 한도가 적용될 수 있습니다.",
    law: "상가건물 임대차보호법 차임 증액 청구 한도(5%) 적용 대상 여부 확인 필요",
    checkPoint: "본 점포의 환산보증금이 서울 법정 기준 이내인지 및 인상률을 협의로 변경 가능한지",
    question: "이 계약의 환산보증금 기준상 5% 인상 한도가 적용되나요? 매년 7% 고정 인상 대신 협의로 수정할 수 있나요?",
  },
  {
    id: "R04",
    severity: "mid",
    title: "관리비 항목 및 임대인 임의 조정 조항",
    source: "관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다",
    reason: "관리비 세부 구성 항목과 인상 기준이 빠져 있어 입점 후 예상치 못한 고정비 상승 위험이 있습니다.",
    law: "관리비 내역 공개 및 합의 조정 특약 권장 (법률 자문 아님)",
    checkPoint: "최근 1년간 실제 부과된 관리비 영수증 및 항목별 세부 내역",
    question:
      "관리비에 수도·전기·청소 중 무엇이 포함되나요? 조정 시 증빙 내역을 공유하고 상호 합의하도록 문구를 넣을 수 있나요?",
  },
];

export const BUSINESS_AUTO_CONDITIONS: Partial<Record<BusinessTypeId, readonly ConditionKey[]>> = {
  delivery: ["delivery"],
  pub: ["alcohol"],
};

export const BUSINESS_TYPES: readonly BusinessType[] = [
  {
    id: "restaurant",
    name: "한식·일반 식당",
    type: "일반음식점",
    edu: "한국외식업중앙회",
    eduUrl: "https://www.ifoodedu.or.kr",
    hrs: 6,
    desc: "밥집, 고깃집, 국숫집처럼 식사를 파는 가게",
  },
  {
    id: "cafe",
    name: "카페·디저트",
    type: "휴게음식점",
    edu: "한국휴게음식업중앙회",
    eduUrl: "https://kcraedu.or.kr",
    hrs: 6,
    desc: "커피, 음료, 디저트를 파는 가게",
  },
  {
    id: "bakery",
    name: "베이커리",
    type: "제과점영업",
    edu: "대한제과협회",
    eduUrl: "https://bakery.or.kr",
    hrs: 6,
    desc: "가게에서 빵과 과자를 직접 구워 파는 곳",
  },
  {
    id: "delivery",
    name: "치킨·피자·배달 전문",
    type: "일반음식점",
    edu: "한국외식업중앙회",
    eduUrl: "https://www.ifoodedu.or.kr",
    hrs: 6,
    desc: "배달과 포장 주문이 대부분인 가게",
  },
  {
    id: "pub",
    name: "호프·주점",
    type: "일반음식점",
    edu: "한국외식업중앙회",
    eduUrl: "https://www.ifoodedu.or.kr",
    hrs: 6,
    desc: "술이 주 메뉴인 가게",
  },
  {
    id: "deli",
    name: "반찬·밀키트",
    type: "즉석판매제조·가공업",
    edu: "한국식품산업협회",
    eduUrl: "https://www.kfia21.or.kr",
    hrs: 8,
    desc: "만든 음식을 포장해서 파는 가게",
  },
];

export const BUSINESS_DISABLED_CONDITIONS: Partial<Record<BusinessTypeId, readonly ConditionKey[]>> = {
  bakery: ["alcohol"],
  deli: ["alcohol"],
};

export const GUIDE_CONDITIONS: readonly { key: ConditionKey; label: string }[] = [
  {
    key: "franchise",
    label: "프랜차이즈 가맹점으로 열어요",
  },
  {
    key: "staff",
    label: "직원이나 아르바이트를 써요",
  },
  {
    key: "big",
    label: "매장이 100㎡ 이상이거나 지하층이에요",
  },
  {
    key: "lpg",
    label: "LPG 가스를 써요",
  },
  {
    key: "delivery",
    label: "배달앱에 입점해요",
  },
  {
    key: "alcohol",
    label: "술도 팔아요",
  },
];

export const POLICIES: readonly Policy[] = [
  {
    cat: "자금",
    title: "소상공인 정책자금",
    org: "소상공인시장진흥공단",
    who: "창업 초기 소상공인",
    what: "운영자금과 시설자금을 시중보다 낮은 금리로 빌려줘요.",
    url: "https://ols.semas.or.kr",
    host: "ols.semas.or.kr",
  },
  {
    cat: "보증",
    title: "창업자금 신용보증",
    org: "서울신용보증재단",
    who: "서울에서 창업하는 소상공인",
    what: "담보가 부족해도 은행 대출을 받을 수 있게 보증서를 발급해요.",
    url: "https://www.seoulshinbo.co.kr",
    host: "seoulshinbo.co.kr",
  },
  {
    cat: "교육",
    title: "신사업창업사관학교",
    org: "소상공인시장진흥공단",
    who: "예비 창업자",
    what: "창업 교육, 점포 체험, 멘토링을 묶어서 지원해요.",
    url: "https://www.sbiz24.kr",
    host: "sbiz24.kr",
  },
  {
    cat: "컨설팅",
    title: "자영업 창업 컨설팅",
    org: "서울시 자영업지원센터",
    who: "서울 예비 창업자와 자영업자",
    what: "상권·입지, 메뉴, 운영 방식을 전문가와 상담해요.",
    url: "https://www.seoulsbdc.or.kr",
    host: "seoulsbdc.or.kr",
  },
  {
    cat: "교육",
    title: "소상공인 지식배움터",
    org: "소상공인시장진흥공단",
    who: "누구나",
    what: "창업 준비, 세무, 마케팅 온라인 강의를 무료로 들을 수 있어요.",
    url: "https://edu.sbiz.or.kr",
    host: "edu.sbiz.or.kr",
  },
];

export const POLICY_CATEGORIES: readonly PolicyCategory[] = ["전체", "자금", "보증", "교육", "컨설팅"];

/** 지도 좌표 1px이 실제 몇 m인지의 역수 (반경 m × MAP_SCALE = px) */
export const MAP_SCALE = 0.21;

export const RADIUS_OPTIONS: readonly { value: RadiusM; label: string }[] = [
  {
    value: 150,
    label: "150m",
  },
  {
    value: 300,
    label: "300m",
  },
  {
    value: 500,
    label: "500m",
  },
  {
    value: 1000,
    label: "1km",
  },
];

type ItemInput = Omit<ChecklistItem, "id" | "t" | "w" | "tag"> & { tag?: ChecklistItem["tag"] };

const GOV24 = ["정부24", "https://www.gov.kr"] as const;
const HOMETAX = ["홈택스", "https://www.hometax.go.kr"] as const;
const FRANCHISE_FTC = ["가맹사업거래", "https://franchise.ftc.go.kr"] as const;
const FOOD_SAFETY = ["식품안전나라", "https://www.foodsafetykorea.go.kr"] as const;
const NAQS = ["농산물품질관리원", "https://www.naqs.go.kr"] as const;

/** 가게 종류와 조건에 맞는 체크리스트. 조건 때문에 붙은 항목은 "조건부", 나머지는 "법적 의무"가 기본이다. */
export function buildChecklist(
  business: BusinessType,
  conditions: Partial<Record<ConditionKey, boolean>>,
): { type: string; groups: ChecklistGroup[] } {
  const alcohol = !!conditions.alcohol;
  const cafeWithAlcohol = business.id === "cafe" && alcohol;
  const type = cafeWithAlcohol ? "일반음식점" : business.type;
  const edu = cafeWithAlcohol ? "한국외식업중앙회" : business.edu;
  const eduUrl = cafeWithAlcohol ? "https://www.ifoodedu.or.kr" : business.eduUrl;
  const eduLink = [edu, eduUrl] as const;
  const item = (
    id: string,
    t: string,
    w: string,
    extra: ItemInput = {},
  ): Omit<ChecklistItem, "tag"> & {
    tag?: ChecklistItem["tag"];
  } => ({ id, t, w, ...extra });

  const before = [
    item("a1", "상권·입지 분석", `${business.name} 경쟁 가게 수, 매출, 생존율 확인`, {
      tag: "권장",
      action: "map",
      go: "상권 탐색하기",
    }),
    item("a2", "건축물 용도 확인", `${type} 영업이 가능한 용도인지 건축물대장으로 확인`, { ext: GOV24 }),
    item("a3", "하수도 원인자부담금 확인", "면적과 업종에 따라 부담금이 생길 수 있어요. 구청 하수 담당 부서", {
      tag: "조건부",
    }),
  ];
  if (conditions.franchise) {
    before.push(
      item(
        "f1",
        "정보공개서 받고 14일 검토",
        "가맹본부는 정보공개서를 준 날부터 14일이 지나야 계약할 수 있어요. 공정위 가맹사업거래 사이트에서 등록 여부도 확인",
        { why: "프랜차이즈", ext: FRANCHISE_FTC },
      ),
      item("f2", "가맹금 예치 확인", "가맹금을 본부 계좌가 아닌 은행 같은 예치기관에 맡기는지 확인", {
        why: "프랜차이즈",
        ext: FRANCHISE_FTC,
      }),
    );
  }
  before.push(
    item(
      "a4",
      conditions.franchise ? "임대차·권리금·가맹 계약" : "임대차·권리금 계약",
      "권리금 계약서는 임대차 계약서와 따로 작성. 서명 전에 검토를 받아 보세요",
      { tag: "권장", action: "contract", go: "계약서 검토하기" },
    ),
  );

  const opening = [];
  if (cafeWithAlcohol) {
    opening.push(
      item(
        "w1",
        "일반음식점으로 신고하기",
        "휴게음식점은 술을 팔 수 없어요. 술을 팔려면 일반음식점으로 영업신고해야 해요",
        {
          why: "술 판매",
          warn: true,
        },
      ),
    );
  }
  opening.push(
    item("b1", "식품위생교육 이수", `${type} 신규 ${business.hrs}시간, ${edu}. 신규 교육은 교육장에 직접 가서 들어요`, {
      ext: eduLink,
    }),
    item(
      "b2",
      "건강진단결과서(보건증)",
      conditions.staff
        ? "보건소에서 검사받고 결과서는 정부24에서 발급. 사장님과 직원 모두 받아야 해요"
        : "보건소에서 검사받고 결과서는 정부24에서 발급. 음식을 다루는 사람은 모두 필요해요",
      conditions.staff ? { why: "직원 고용", ext: GOV24 } : { ext: GOV24 },
    ),
  );
  if (conditions.big) {
    opening.push(
      item(
        "b3",
        "소방시설 완비증명서",
        "영업장이 100㎡ 이상(지하층은 66㎡ 이상)이면 다중이용업소예요. 영업신고 전에 관할 소방서에서 받아요",
        { why: "매장 면적" },
      ),
      item("b4", "화재배상책임보험 가입", "다중이용업소는 문 열기 전에 가입해야 해요", { why: "매장 면적" }),
    );
  }
  if (conditions.lpg) {
    opening.push(
      item("b5", "가스시설 완성검사", "한국가스안전공사에서 검사받은 뒤 가스 공급 계약", {
        why: "LPG 사용",
        ext: ["한국가스안전공사", "https://www.kgs.or.kr"],
      }),
    );
  }
  if (business.id === "deli") {
    opening.push(
      item("p1", "제품 표시사항 준비", "포장에 제품명, 원재료, 소비기한 등을 표시해요", { ext: FOOD_SAFETY }),
    );
  }
  opening.push(
    item("b6", "영업신고", `${type}으로 신고. 위 서류를 갖춰 구청 위생과에 가거나 정부24에서 온라인 신청`, {
      ext: GOV24,
    }),
    item("b7", "사업자등록", "영업신고증을 들고 세무서 또는 홈택스에서. 일반·간이과세자 중 선택", { ext: HOMETAX }),
  );
  if (conditions.staff) {
    opening.push(
      item(
        "s1",
        "근로계약서 작성·교부",
        "근무 시간, 임금, 휴일을 적어 서면으로 나눠 가져요. 표준근로계약서 양식은 고용노동부에서",
        { why: "직원 고용", ext: ["고용노동부", "https://www.moel.go.kr"] },
      ),
    );
  }

  const after = [];
  if (!["bakery", "deli"].includes(business.id)) {
    after.push(item("c1", "원산지 표시", "메뉴판과 게시판에 쌀, 고기, 김치 같은 주요 재료 원산지 표시", { ext: NAQS }));
  }
  if (conditions.delivery) {
    after.push(
      item("d1", "배달앱 원산지 표시", "배달앱 메뉴 화면에도 원산지를 똑같이 표시해야 해요", {
        why: "배달앱",
        ext: NAQS,
      }),
    );
  }
  if (alcohol) {
    after.push(
      item("c2", "청소년 주류 판매 금지 표시", "가게 안에 표시를 붙이고, 어려 보이는 손님은 신분증 확인", {
        why: "술 판매",
      }),
    );
  }
  if (conditions.staff) {
    after.push(
      item("s2", "4대보험 취득신고", "고용한 날이 속한 달의 다음 달 15일까지", {
        why: "직원 고용",
        ext: ["4대사회보험", "https://www.4insure.or.kr"],
      }),
    );
  }
  after.push(
    item(
      "c3",
      "매년 위생교육",
      conditions.franchise
        ? "기존 영업자는 매년 3시간. 가맹점은 프랜차이즈산업협회 온라인 교육으로도 들을 수 있어요"
        : "기존 영업자는 매년 3시간, 온라인으로도 들을 수 있어요",
      { ext: conditions.franchise ? ["프랜차이즈산업협회", "https://www.kfafoodedu.or.kr"] : eduLink },
    ),
    item("c4", "부가가치세 신고", "일반과세자는 1월과 7월, 간이과세자는 1월", { ext: HOMETAX }),
    item("c5", "종합소득세 신고", "매년 5월", { ext: HOMETAX }),
  );
  if (business.id !== "deli") {
    after.push(
      item("c6", "위생등급 지정 신청 (선택)", "식품의약품안전처, 식품안전나라에서 신청", {
        tag: "권장",
        ext: FOOD_SAFETY,
      }),
    );
  }

  const withTag = (items: ReturnType<typeof item>[]): ChecklistItem[] =>
    items.map((entry) => ({ ...entry, tag: entry.tag ?? (entry.why ? "조건부" : "법적 의무") }));

  return {
    type,
    groups: [
      { name: "계약 전", items: withTag(before) },
      { name: "문 열기 전", items: withTag(opening) },
      { name: "문 연 뒤", items: withTag(after) },
    ],
  };
}

export function createContractFields(): ContractField[] {
  return [
    {
      key: "deposit",
      label: "보증금",
      unit: "만원",
      numeric: true,
      value: 5000,
      conf: 0.97,
      src: "보증금 금 오천만원정(₩50,000,000)",
      ok: false,
      input: "5000",
    },
    {
      key: "rent",
      label: "월세 (차임)",
      unit: "만원",
      numeric: true,
      value: 300,
      conf: 0.95,
      src: "차임 월 금 삼백만원정(₩3,000,000), 부가가치세 별도",
      ok: false,
      input: "300",
    },
    {
      key: "mgmt",
      label: "월 관리비",
      unit: "만원",
      numeric: true,
      value: null,
      conf: 0.58,
      src: "관리비는 월 금 3?만원으로 하되 임대인이 필요 시 조정할 수 있다",
      ok: false,
      input: "",
    },
    {
      key: "vat",
      label: "월세 부가세",
      unit: "",
      numeric: false,
      value: "별도",
      conf: 0.93,
      src: "차임에 대한 부가가치세는 임차인이 별도 부담한다",
      ok: false,
      input: "별도",
    },
    {
      key: "term",
      label: "계약 기간",
      unit: "개월",
      numeric: true,
      value: 24,
      conf: 0.96,
      src: "임대차 기간은 인도일로부터 24개월로 한다",
      ok: false,
      input: "24",
    },
    {
      key: "raise",
      label: "연 월세 인상률",
      unit: "%",
      numeric: true,
      value: 7,
      conf: 0.9,
      src: "임차인은 매년 차임을 7% 인상하는 데 동의한다",
      ok: false,
      input: "7",
    },
    {
      key: "penalty",
      label: "중도해지 위약금",
      unit: "",
      numeric: false,
      value: "잔여 기간 차임 전액",
      conf: 0.88,
      src: "임차인 사정으로 해지 시 잔여 기간 차임 전액을 위약금으로 지급한다",
      ok: false,
      input: "잔여 기간 차임 전액",
    },
    {
      key: "restore",
      label: "원상복구비",
      unit: "만원",
      numeric: true,
      value: null,
      conf: 0.41,
      src: "임차인은 퇴거 시 공실 상태로 원상복구한다 (금액 미기재)",
      ok: false,
      input: "",
    },
  ];
}

export const INITIAL_PIN: Point = { x: MAP_SIZE.width / 2, y: MAP_SIZE.height / 2 };

export const INITIAL_FORM: FormState = {
  areaM2: "66",
  depositMan: "5000",
  rentMan: "250",
  maintenanceMan: "30",
  rentVatSeparate: false,
  laborMan: "300",
  otherFixedMan: "120",
  variableCostRate: "40",
  expectedSalesMan: "1650",
  keyMoneyMan: "3000",
  facilityCostMan: "4500",
  annualEscalationPct: "5",
  exitMonth: "12",
  remainingObligationMonths: "12",
  penaltyMan: "500",
  restorationMan: "1000",
  penaltyOverlapsRent: false,
};
