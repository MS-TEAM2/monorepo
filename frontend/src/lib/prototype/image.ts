import { analyzePixels, type ImageCheck } from "./image-analysis";
import { hashBytes } from "./recognition";

const MAX_EDGE = 1024;

/**
 * 올린 사진을 긴 변 1024px JPEG 로 줄인다 (sessionStorage 용량, 이후 API 업로드 크기).
 * 해시는 원본 바이트로 만들어 같은 사진은 같은 결과가 나오게 한다.
 */
export async function prepareUpload(file: File): Promise<{ dataUrl: string; seed: number }> {
  const seed = hashBytes(new Uint8Array(await file.arrayBuffer()));
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지를 처리할 수 없어요");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.82), seed };
}

/** 검사용으로 줄일 긴 변 길이. 작을수록 빠르고, 상품 위치를 잡기엔 이 정도면 충분하다 */
const CHECK_EDGE = 96;

/** 사진(data URL)을 작게 그려 밝기·상품 위치를 본다 (image-analysis.ts) */
export async function checkImage(src: string): Promise<ImageCheck> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = CHECK_EDGE / Math.max(image.naturalWidth, image.naturalHeight);
  const width = Math.max(8, Math.round(image.naturalWidth * scale));
  const height = Math.max(8, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("이미지를 처리할 수 없어요");
  context.drawImage(image, 0, 0, width, height);
  return analyzePixels(context.getImageData(0, 0, width, height).data, width, height);
}
