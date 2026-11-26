import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AddressSearch } from "@/components/address-search";
import { sampleGeocoder } from "@/lib/address/geocoder";
import { selectAddress } from "@/lib/address/select";
import { resolveSampleRegion } from "@/lib/mock/regions";

const resolve = async (lat: number, lng: number) => resolveSampleRegion(lat, lng);

describe("예시 주소 검색", () => {
  it("장소 이름이나 주소 일부로 찾는다", async () => {
    const results = await sampleGeocoder.search("홍대");
    expect(results[0]).toMatchObject({ address: "서울 마포구 양화로 160" });
    expect(await sampleGeocoder.search("세종 대로")).toHaveLength(1);
  });

  it("두 글자 미만이거나 없는 주소면 빈 결과다", async () => {
    expect(await sampleGeocoder.search("홍")).toEqual([]);
    expect(await sampleGeocoder.search("없는주소xyz")).toEqual([]);
  });
});

describe("주소 선택", () => {
  it("서울 주소는 위도·경도·주소·행정동을 돌려준다", async () => {
    const [result] = await sampleGeocoder.search("강남역");
    const selection = await selectAddress(result!, resolve);
    expect(selection).toEqual({
      status: "supported",
      value: {
        lat: 37.4979,
        lng: 127.0276,
        address: "서울 강남구 강남대로 396",
        dongCode: "sample-1103",
        dongName: "역삼1동",
        guName: "강남구",
      },
    });
  });

  it("서울 밖이면 지원 지역 안내 상태다", async () => {
    for (const query of ["판교", "해운대"]) {
      const [result] = await sampleGeocoder.search(query);
      expect(await selectAddress(result!, resolve)).toEqual({ status: "out_of_service" });
    }
  });

  it("A04 예시 응답은 서울 밖에서 supported: false 와 null 을 준다", () => {
    expect(resolveSampleRegion(35.1587, 129.1604)).toEqual({
      dong_code: null,
      dong_name: null,
      gu_name: null,
      supported: false,
    });
  });
});

describe("AddressSearch", () => {
  it("입력칸·검색 버튼·예시 데이터 표시를 그린다", () => {
    const markup = renderToStaticMarkup(createElement(AddressSearch, { onSelect: () => {} }));
    expect(markup).toContain('role="search"');
    expect(markup).toContain("주소 검색");
    expect(markup).toContain("예시 데이터");
  });
});
