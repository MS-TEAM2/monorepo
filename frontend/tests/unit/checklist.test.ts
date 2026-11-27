import { describe, expect, it } from "vitest";

import items from "@/lib/checklist/items.json";
import { publishedEntries, validateChecklist } from "@/lib/checklist/validate";

const TODAY = "2026-11-27";

/** 검사를 통과하는 항목 하나 */
function validEntry(): Record<string, unknown> {
  return {
    id: "sample-item",
    phase: "영업신고 전",
    title: "영업신고",
    description: "구청 위생과나 정부24에서 신청해요.",
    tag: "법적 의무",
    reportTypes: ["일반음식점"],
    condition: { text: "모든 영업자" },
    source: { name: "정부24", url: "https://www.gov.kr" },
    checkedAt: "2026-11-20",
    verified: true,
  };
}

function errorsOf(entry: Record<string, unknown>): string[] {
  return validateChecklist([entry], { today: TODAY }).errors;
}

describe("체크리스트 예시 파일", () => {
  it("형식 검사를 통과한다", () => {
    const result = validateChecklist(items, { today: TODAY });
    expect(result.errors).toEqual([]);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("시기 세 가지를 모두 담고 있다", () => {
    const phases = new Set(validateChecklist(items, { today: TODAY }).items.map((item) => item.phase));
    expect([...phases].sort()).toEqual(["개업 전후", "계약 전", "영업신고 전"].sort());
  });

  it("원문 대조 전 예시라 공개 항목이 없다 (R4)", () => {
    expect(publishedEntries(validateChecklist(items, { today: TODAY }).items)).toEqual([]);
  });
});

describe("validateChecklist — 완료 조건: 구분·조건·출처·확인일이 없으면 실패", () => {
  it("모든 값이 있으면 통과한다", () => {
    expect(errorsOf(validEntry())).toEqual([]);
  });

  it.each([
    ["tag", "구분이 없어요"],
    ["condition", "적용 조건이 없어요"],
    ["source", "출처가 없어요"],
    ["checkedAt", "확인일이 없어요"],
  ])("%s가 없으면 실패한다", (field, message) => {
    const entry = validEntry();
    delete entry[field];
    expect(errorsOf(entry)).toContain(`sample-item: ${message}`);
  });

  it("빈 값도 없는 것으로 본다", () => {
    expect(errorsOf({ ...validEntry(), tag: "" })).toContain("sample-item: 구분이 없어요");
    expect(errorsOf({ ...validEntry(), tag: " " })).toContain("sample-item: 구분이 없어요");
    expect(errorsOf({ ...validEntry(), tag: null })).toContain("sample-item: 구분이 없어요");
    expect(errorsOf({ ...validEntry(), condition: { text: " " } })).toContain("sample-item: 적용 조건이 없어요");
    expect(errorsOf({ ...validEntry(), source: { name: "", url: "https://www.gov.kr" } })).toContain(
      "sample-item: 출처가 없어요",
    );
    expect(errorsOf({ ...validEntry(), checkedAt: "" })).toContain("sample-item: 확인일이 없어요");
  });

  it("오류가 있으면 항목을 하나도 돌려주지 않는다", () => {
    const entry = validEntry();
    delete entry.source;
    expect(validateChecklist([validEntry(), { ...entry, id: "broken" }], { today: TODAY }).items).toEqual([]);
  });
});

describe("validateChecklist — 값 검사", () => {
  it("정해진 구분·시기·신고 종류만 받는다", () => {
    expect(errorsOf({ ...validEntry(), tag: "필수" })).toEqual([
      "sample-item: 구분은 법적 의무·조건부·권장 중 하나여야 해요",
    ]);
    expect(errorsOf({ ...validEntry(), phase: "문 연 뒤" })).toHaveLength(1);
    expect(errorsOf({ ...validEntry(), reportTypes: ["즉석판매제조·가공업"] })).toHaveLength(1);
    expect(errorsOf({ ...validEntry(), reportTypes: [] })).toContain("sample-item: 적용 신고 종류가 없어요");
  });

  it("조건부 항목은 조건 키가 있어야 한다", () => {
    expect(errorsOf({ ...validEntry(), tag: "조건부" })).toContain(
      "sample-item: 조건부 항목은 조건 키가 1개 이상 있어야 해요",
    );
    expect(
      errorsOf({ ...validEntry(), tag: "조건부", condition: { text: "직원을 쓰는 경우", keys: ["staff"] } }),
    ).toEqual([]);
    expect(errorsOf({ ...validEntry(), condition: { text: "직원", keys: ["employee"] } })).toHaveLength(1);
  });

  it("확인일은 실제 날짜이고 오늘보다 뒤가 아니어야 한다", () => {
    expect(errorsOf({ ...validEntry(), checkedAt: "2026/11/20" })).toHaveLength(1);
    expect(errorsOf({ ...validEntry(), checkedAt: "2026-02-30" })).toHaveLength(1);
    expect(errorsOf({ ...validEntry(), checkedAt: "2026-11-28" })).toContain("sample-item: 확인일이 오늘보다 뒤예요");
    expect(errorsOf({ ...validEntry(), checkedAt: TODAY })).toEqual([]);
  });

  it("주소는 https만 받는다", () => {
    expect(errorsOf({ ...validEntry(), source: { name: "정부24", url: "http://www.gov.kr" } })).toContain(
      "sample-item: 출처 주소는 https로 시작해야 해요",
    );
    expect(errorsOf({ ...validEntry(), link: { label: "정부24", url: "javascript:alert(1)" } })).toHaveLength(1);
  });

  it("id 형식과 중복을 검사한다", () => {
    expect(errorsOf({ ...validEntry(), id: "Sample Item" })).toHaveLength(1);
    expect(validateChecklist([validEntry(), validEntry()], { today: TODAY }).errors).toEqual([
      "sample-item: id가 겹쳐요",
    ]);
  });

  it("verified는 true·false만 받는다", () => {
    const entry = validEntry();
    delete entry.verified;
    expect(errorsOf(entry)).toHaveLength(1);
  });

  it("배열이 아니면 실패한다", () => {
    expect(validateChecklist({}).errors).toEqual(["체크리스트는 항목 배열이어야 해요"]);
  });
});

describe("publishedEntries", () => {
  it("원문과 대조한 항목만 남긴다", () => {
    const result = validateChecklist([validEntry(), { ...validEntry(), id: "not-verified", verified: false }], {
      today: TODAY,
    });
    expect(publishedEntries(result.items).map((item) => item.id)).toEqual(["sample-item"]);
  });
});
