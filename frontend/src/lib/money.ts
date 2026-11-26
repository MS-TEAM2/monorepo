/**
 * 금액 표시. 한국 사람이 읽는 방식대로 억·만 단위로 끊는다.
 *   145,140,000원 → "1억 4,514만원", 100,000,000원 → "1억원", 3,000원 → "3,000원"
 * 만원 아래는 반올림한다(만원 단위 화면). 1만원보다 작으면 원 단위로 보여 준다.
 */
export function formatKrw(krw: number | null | undefined, { showSign = false } = {}): string {
  if (krw === null || krw === undefined || Number.isNaN(krw)) return "-";
  const sign = krw < 0 ? "-" : showSign && krw > 0 ? "+" : "";
  const abs = Math.abs(krw);
  if (abs < 10_000) return `${sign}${Math.round(abs).toLocaleString("ko-KR")}원`;
  const man = Math.round(abs / 10_000);
  return `${sign}${formatManUnits(man)}`;
}

/** 만원 단위 정수를 "1억 4,514만원"처럼 바꾼다 */
export function formatManUnits(man: number): string {
  const abs = Math.abs(Math.round(man));
  const eok = Math.floor(abs / 10_000);
  const rest = abs % 10_000;
  if (eok === 0) return `${rest.toLocaleString("ko-KR")}만원`;
  return rest === 0
    ? `${eok.toLocaleString("ko-KR")}억원`
    : `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}만원`;
}

/** 만원 단위 입력값을 읽기 쉬운 금액으로. 비었거나 숫자가 아니면 null */
export function readableManInput(value: string): string | null {
  if (value.trim() === "") return null;
  const man = Number(value);
  if (!Number.isFinite(man) || man <= 0) return null;
  return formatManUnits(man);
}
