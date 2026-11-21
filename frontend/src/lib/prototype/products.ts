/**
 * 프로토타입용 샘플 상품과 판매처 가격. API 가 생기면 이 파일 대신 docs/api/openapi.yaml 타입을 쓴다.
 * 가격·바코드는 모두 화면 확인용 샘플 값이다 (실제 가격·실제 바코드 아님).
 */

export type Category = "snack" | "drink";
export type Seller = "coupang" | "naver";

export type Offer = {
  id: string;
  seller: Seller;
  /** 판매 글 제목 */
  title: string;
  /** 한 번에 사는 개수 (1 = 낱개) */
  quantity: number;
  /** 구성 전체 가격(원), 배송비 제외 */
  price: number;
  /** 무료배송 여부. 배송비 금액은 수집하지 않으므로, 무료가 아니면 "배송비 별도"로만 표시한다 */
  freeShipping: boolean;
  url: string;
};

export type Product = {
  id: string;
  brand: string;
  name: string;
  flavor?: string;
  category: Category;
  /** 1개 용량. 과자는 g, 음료는 ml */
  volume: number;
  unit: "g" | "ml";
  barcode: string;
  /** 가격을 마지막으로 조회한 시각까지 지난 분 */
  updatedMinutesAgo: number;
  offers: Offer[];
};

const coupang = (q: string) => `https://www.coupang.com/np/search?q=${encodeURIComponent(q)}`;
const naver = (q: string) => `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(q)}`;

function offers(query: string, rows: [Seller, number, number, boolean][]): Offer[] {
  return rows.map(([seller, quantity, price, freeShipping], index) => ({
    id: `${seller}-${quantity}-${index}`,
    seller,
    title: quantity === 1 ? `${query} 1개` : `${query} ${quantity}개 묶음`,
    quantity,
    price,
    freeShipping,
    url: seller === "coupang" ? coupang(query) : naver(query),
  }));
}

export const PRODUCTS: Product[] = [
  {
    id: "nongshim-saewookkang-90",
    brand: "농심",
    name: "새우깡",
    flavor: "오리지널",
    category: "snack",
    volume: 90,
    unit: "g",
    barcode: "8800000000001",
    updatedMinutesAgo: 4,
    offers: offers("농심 새우깡 90g", [
      ["coupang", 1, 1480, false],
      ["coupang", 10, 11900, true],
      ["naver", 1, 1390, false],
      ["naver", 20, 22800, true],
      ["naver", 5, 6450, false],
    ]),
  },
  {
    id: "orion-pocachip-original-66",
    brand: "오리온",
    name: "포카칩",
    flavor: "오리지널",
    category: "snack",
    volume: 66,
    unit: "g",
    barcode: "8800000000002",
    updatedMinutesAgo: 7,
    offers: offers("오리온 포카칩 오리지널 66g", [
      ["coupang", 1, 1690, false],
      ["coupang", 12, 16900, true],
      ["naver", 1, 1600, false],
      ["naver", 6, 8990, true],
    ]),
  },
  {
    id: "orion-pocachip-onion-66",
    brand: "오리온",
    name: "포카칩",
    flavor: "어니언",
    category: "snack",
    volume: 66,
    unit: "g",
    barcode: "8800000000003",
    updatedMinutesAgo: 7,
    offers: offers("오리온 포카칩 어니언 66g", [
      ["coupang", 1, 1690, false],
      ["coupang", 12, 17400, true],
      ["naver", 6, 9300, true],
    ]),
  },
  {
    id: "haitai-honeybutter-60",
    brand: "해태",
    name: "허니버터칩",
    category: "snack",
    volume: 60,
    unit: "g",
    barcode: "8800000000004",
    updatedMinutesAgo: 12,
    offers: offers("해태 허니버터칩 60g", [
      ["coupang", 1, 1780, false],
      ["coupang", 8, 12900, true],
      ["naver", 1, 1700, false],
      ["naver", 16, 24900, true],
    ]),
  },
  {
    id: "orion-chocopie-12",
    brand: "오리온",
    name: "초코파이 정 12개입",
    category: "snack",
    volume: 468,
    unit: "g",
    barcode: "8800000000005",
    updatedMinutesAgo: 3,
    offers: offers("오리온 초코파이 12개입", [
      ["coupang", 1, 5280, true],
      ["coupang", 3, 14900, true],
      ["naver", 1, 4990, false],
      ["naver", 2, 10200, true],
    ]),
  },
  {
    id: "lotte-chilsung-500",
    brand: "롯데칠성",
    name: "칠성사이다",
    category: "drink",
    volume: 500,
    unit: "ml",
    barcode: "8800000000006",
    updatedMinutesAgo: 5,
    offers: offers("칠성사이다 500ml", [
      ["coupang", 1, 1350, false],
      ["coupang", 20, 19900, true],
      ["naver", 24, 22900, true],
      ["naver", 6, 7800, false],
    ]),
  },
  {
    id: "cocacola-500",
    brand: "코카콜라",
    name: "코카콜라",
    flavor: "오리지널",
    category: "drink",
    volume: 500,
    unit: "ml",
    barcode: "8800000000007",
    updatedMinutesAgo: 9,
    offers: offers("코카콜라 500ml", [
      ["coupang", 1, 1600, false],
      ["coupang", 24, 28900, true],
      ["naver", 1, 1500, false],
      ["naver", 20, 24500, true],
    ]),
  },
  {
    id: "cocacola-zero-500",
    brand: "코카콜라",
    name: "코카콜라 제로",
    category: "drink",
    volume: 500,
    unit: "ml",
    barcode: "8800000000008",
    updatedMinutesAgo: 9,
    offers: offers("코카콜라 제로 500ml", [
      ["coupang", 1, 1600, false],
      ["coupang", 24, 27900, true],
      ["naver", 20, 23900, true],
    ]),
  },
  {
    id: "donga-pocari-620",
    brand: "동아오츠카",
    name: "포카리스웨트",
    category: "drink",
    volume: 620,
    unit: "ml",
    barcode: "8800000000009",
    updatedMinutesAgo: 15,
    offers: offers("포카리스웨트 620ml", [
      ["coupang", 1, 1980, false],
      ["coupang", 20, 26900, true],
      ["naver", 1, 1890, false],
      ["naver", 12, 17800, true],
    ]),
  },
  {
    id: "binggrae-banana-240",
    brand: "빙그레",
    name: "바나나맛우유",
    category: "drink",
    volume: 240,
    unit: "ml",
    barcode: "8800000000010",
    updatedMinutesAgo: 6,
    offers: offers("빙그레 바나나맛우유 240ml", [
      ["coupang", 1, 1700, false],
      ["coupang", 8, 11900, true],
      ["naver", 4, 6200, false],
      ["naver", 24, 33900, true],
    ]),
  },
];

export function getProduct(id: string | null | undefined): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function productTitle(product: Product): string {
  return product.flavor ? `${product.name} ${product.flavor}` : product.name;
}

export const SELLER_NAME: Record<Seller, string> = { coupang: "쿠팡", naver: "네이버쇼핑" };
export const CATEGORY_NAME: Record<Category, string> = { snack: "과자", drink: "음료" };
