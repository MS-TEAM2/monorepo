import { expect, test } from "vitest";

import { pickPictureSize } from "../src/lib/picture-size";

test("긴 변이 기준 이상인 크기 중 가장 작은 것을 고른다", () => {
  expect(pickPictureSize(["4032x3024", "640x480", "1280x960", "1920x1080"])).toBe("1280x960");
});

test("모두 기준보다 작으면 가장 큰 것", () => {
  expect(pickPictureSize(["320x240", "640x480"])).toBe("640x480");
});

test("iOS 프리셋만 있으면 Medium", () => {
  expect(pickPictureSize(["Photo", "High", "Medium", "Low"])).toBe("Medium");
  expect(pickPictureSize(["Photo"])).toBeUndefined();
});
