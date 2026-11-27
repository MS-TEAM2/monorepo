import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CategoryFilter, RadiusFilter } from "@/components/explore/explore-filters";
import {
  DEFAULT_RADIUS,
  latLngToOffset,
  offsetToLatLng,
  queryCategories,
  RADIUS_OPTIONS,
  radiusLabel,
  toggleCategory,
} from "@/lib/explore";

describe("업종 선택", () => {
  it("여러 개를 넣고 빼며 9종 순서를 지킨다", () => {
    let selected = toggleCategory([], "cafe");
    selected = toggleCategory(selected, "korean");
    expect(selected).toEqual(["korean", "cafe"]);
    expect(toggleCategory(selected, "cafe")).toEqual(["korean"]);
  });

  it("하나도 고르지 않으면 9종 전체를 조회한다", () => {
    expect(queryCategories([])).toHaveLength(9);
    expect(queryCategories(["bakery"])).toEqual(["bakery"]);
  });
});

describe("반경", () => {
  it("150m·300m·500m·1km, 기본 500m", () => {
    expect(RADIUS_OPTIONS).toEqual([150, 300, 500, 1000]);
    expect(DEFAULT_RADIUS).toBe(500);
    expect(RADIUS_OPTIONS.map(radiusLabel)).toEqual(["150m", "300m", "500m", "1km"]);
  });
});

describe("길게 누른 지점 좌표", () => {
  const center = { lat: 37.5717, lng: 126.9768 };

  it("중심에서 떨어진 미터를 좌표로 바꾸고 되돌린다", () => {
    const point = offsetToLatLng(center, 300, -400);
    expect(point.lat).toBeGreaterThan(center.lat); // 위쪽(북)
    expect(point.lng).toBeGreaterThan(center.lng); // 오른쪽(동)
    const back = latLngToOffset(center, point);
    expect(back.dxM).toBeCloseTo(300, 6);
    expect(back.dyM).toBeCloseTo(-400, 6);
  });

  it("남북 1km 는 위도 약 0.009도", () => {
    expect(center.lat - offsetToLatLng(center, 0, 1000).lat).toBeCloseTo(0.00898, 4);
  });
});

describe("필터 화면", () => {
  it("업종 칩 9종 + 전체, 선택 상태를 aria-pressed 로 알린다", () => {
    const markup = renderToStaticMarkup(createElement(CategoryFilter, { selected: ["cafe"], onChange: () => {} }));
    expect(markup.match(/aria-pressed=/g)).toHaveLength(10);
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it("반경 4개 중 하나가 눌려 있다", () => {
    const markup = renderToStaticMarkup(createElement(RadiusFilter, { value: 500, onChange: () => {} }));
    expect(markup.match(/aria-pressed=/g)).toHaveLength(4);
    expect(markup).toMatch(/aria-pressed="true"[^>]*>500m/);
  });
});
