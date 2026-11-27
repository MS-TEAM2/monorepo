import type { Metadata } from "next";

import { E2EPrototype } from "@/components/e2e-prototype";

export const metadata: Metadata = {
  title: "기획 검증 프로토타입",
  description: "가상 입력으로 창업 진단에서 계약 조건 비교까지 확인하는 시연용 프로토타입",
};

export default function PrototypePage() {
  return <E2EPrototype />;
}
