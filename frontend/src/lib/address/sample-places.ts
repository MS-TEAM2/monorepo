/**
 * 예시 주소 목록. 네이버지도 geocoder 키가 준비되기 전까지 주소 검색과 A04 예시 응답이 함께 쓴다.
 * 좌표는 공개된 장소 주변의 대략적인 값이고, 행정동 코드는 실제 코드가 아닌 예시 값(sample-)이다.
 * 서울 밖 주소는 지원 지역 안내를 확인하려고 넣었다.
 */
export type SamplePlace = {
  address: string;
  /** 검색어와 맞춰 볼 별칭 */
  keywords: string[];
  lat: number;
  lng: number;
  /** 서울 밖이면 null */
  region: { dong_code: string; dong_name: string; gu_name: string } | null;
};

export const SAMPLE_PLACES: readonly SamplePlace[] = [
  {
    address: "서울 종로구 세종대로 172",
    keywords: ["광화문", "세종대로", "종로"],
    lat: 37.5717,
    lng: 126.9768,
    region: { dong_code: "sample-1101", dong_name: "사직동", gu_name: "종로구" },
  },
  {
    address: "서울 마포구 양화로 160",
    keywords: ["홍대", "홍대입구", "양화로", "마포", "서교동"],
    lat: 37.5571,
    lng: 126.9245,
    region: { dong_code: "sample-1102", dong_name: "서교동", gu_name: "마포구" },
  },
  {
    address: "서울 강남구 강남대로 396",
    keywords: ["강남역", "강남대로", "강남", "역삼동"],
    lat: 37.4979,
    lng: 127.0276,
    region: { dong_code: "sample-1103", dong_name: "역삼1동", gu_name: "강남구" },
  },
  {
    address: "서울 성동구 성수이로 113",
    keywords: ["성수", "성수동", "성동"],
    lat: 37.5446,
    lng: 127.0557,
    region: { dong_code: "sample-1104", dong_name: "성수2가1동", gu_name: "성동구" },
  },
  {
    address: "서울 용산구 이태원로 177",
    keywords: ["이태원", "용산"],
    lat: 37.5345,
    lng: 126.9946,
    region: { dong_code: "sample-1105", dong_name: "이태원1동", gu_name: "용산구" },
  },
  {
    address: "서울 송파구 올림픽로 300",
    keywords: ["잠실", "송파", "올림픽로"],
    lat: 37.5125,
    lng: 127.1025,
    region: { dong_code: "sample-1106", dong_name: "잠실3동", gu_name: "송파구" },
  },
  {
    address: "서울 관악구 관악로 145",
    keywords: ["관악", "서울대입구", "봉천"],
    lat: 37.4784,
    lng: 126.9516,
    region: { dong_code: "sample-1107", dong_name: "청룡동", gu_name: "관악구" },
  },
  {
    address: "서울 영등포구 여의대로 108",
    keywords: ["여의도", "영등포", "여의대로"],
    lat: 37.5259,
    lng: 126.9284,
    region: { dong_code: "sample-1108", dong_name: "여의동", gu_name: "영등포구" },
  },
  {
    address: "경기 성남시 분당구 판교역로 166",
    keywords: ["판교", "분당", "성남"],
    lat: 37.3948,
    lng: 127.1112,
    region: null,
  },
  {
    address: "부산 해운대구 해운대해변로 264",
    keywords: ["해운대", "부산"],
    lat: 35.1587,
    lng: 129.1604,
    region: null,
  },
];
