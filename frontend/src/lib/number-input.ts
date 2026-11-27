/** 숫자와 소수점 하나만 남긴다. 위아래 화살표가 생기는 type="number" 대신 텍스트 입력으로 받는다. */
export function sanitizeNumber(raw: string): string {
  const digits = raw.replace(/[^\d.]/g, "");
  const [whole = "", ...rest] = digits.split(".");
  return rest.length ? `${whole}.${rest.join("")}` : whole;
}

/** 현재 값에 amount를 더한다. max가 있으면 넘지 않게 자르고, 소수 오차를 정리한다. */
export function addAmount(value: string, amount: number, max?: number): string {
  const current = Number(value) || 0;
  const next = Math.round((current + amount) * 100) / 100;
  return String(max !== undefined ? Math.min(max, next) : next);
}

/**
 * 만원 단위 값을 입력 칸에 보여 줄 글자로 바꾼다. 1억 이상이면 억과 만을 나눈다.
 * 예: "12000" → { text: "1억 2,000", unit: "만원" }, "10000" → { text: "1억", unit: "원" }
 */
export function formatManInput(value: string): { text: string; unit: string } {
  if (value === "") return { text: "", unit: "만원" };
  const man = Math.round(Number(value) || 0);
  const eok = Math.floor(man / 10000);
  const rest = man % 10000;
  if (eok === 0) return { text: rest.toLocaleString("ko-KR"), unit: "만원" };
  if (rest === 0) return { text: `${eok.toLocaleString("ko-KR")}억`, unit: "원" };
  return { text: `${eok.toLocaleString("ko-KR")}억 ${rest.toLocaleString("ko-KR")}`, unit: "만원" };
}
