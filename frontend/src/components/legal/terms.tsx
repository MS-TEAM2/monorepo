import { POLICY_VERSION } from "@/lib/prototype/consent";

import { DraftNotice, Section, SubPage, Todo } from "./sub-page";

/** 서비스 이용약관 초안. 운영 주체·분쟁 관할 등 확정되지 않은 값은 Todo 로 남긴다 */
export function Terms() {
  return (
    <SubPage title="서비스 이용약관">
      <DraftNotice />

      <Section title="제1조 목적">
        <p>
          이 약관은 <Todo>운영 주체</Todo>가 제공하는 환승결제(이하 &quot;서비스&quot;)의 이용 조건과 절차를 정해요.
        </p>
      </Section>

      <Section title="제2조 서비스 내용">
        <p>
          매장에서 비춘 상품의 온라인 판매처 가격을 모아 100g(100ml)당 가격으로 비교해 보여 줘요. 로그인하면 찾아본 상품
          기록과 즐겨찾기를 쓸 수 있어요.
        </p>
      </Section>

      <Section title="제3조 가격 정보">
        <p>
          보여 주는 가격은 조회 시점의 판매처 정보라 실제 결제 가격·배송비·재고와 다를 수 있어요. 구매 전에 판매처에서
          최종 가격을 확인해 주세요. 상품 인식 결과도 틀릴 수 있어요.
        </p>
      </Section>

      <Section title="제4조 회원 가입과 탈퇴">
        <p>만 14세 이상이 카카오·구글 계정으로 가입할 수 있어요.</p>
        <p>기록 탭 → 내 정보에서 언제든 탈퇴할 수 있고, 탈퇴하면 기록·즐겨찾기가 바로 지워져요.</p>
      </Section>

      <Section title="제5조 이용자의 의무">
        <p>다른 사람의 계정을 쓰거나, 서비스를 자동화된 방법으로 대량 조회하거나, 운영을 방해해서는 안 돼요.</p>
      </Section>

      <Section title="제6조 책임의 제한">
        <p>
          판매처에서 이루어지는 거래는 이용자와 판매처 사이의 일이에요. 서비스는 가격 정보 오류로 생긴 손해에 대해
          고의나 중대한 과실이 없으면 책임지지 않아요. <Todo>법무 검토 후 문구 확정</Todo>
        </p>
      </Section>

      <Section title="제7조 약관 변경">
        <p>약관을 바꾸면 시행 7일 전(이용자에게 불리하면 30일 전)부터 앱에서 알려요.</p>
      </Section>

      <Section title="제8조 문의와 분쟁">
        <p>
          문의처: <Todo>고객 문의 연락처</Todo>. 관할 법원: <Todo>법무 검토 후 기재</Todo>
        </p>
        <p>문서 버전 {POLICY_VERSION}</p>
      </Section>
    </SubPage>
  );
}
