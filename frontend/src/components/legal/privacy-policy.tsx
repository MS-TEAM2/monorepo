import { COLLECTION_NOTICE, POLICY_VERSION, REFUSAL_NOTICE } from "@/lib/prototype/consent";

import { DraftNotice, Section, SubPage, Todo } from "./sub-page";

/**
 * 개인정보 처리방침 (개인정보 보호법 제30조, 시행령 제31조의 기재 사항 순서).
 * 확정되지 않은 값은 지어내지 않고 Todo 로 남긴다.
 */
export function PrivacyPolicy() {
  return (
    <SubPage title="개인정보 처리방침">
      <DraftNotice />

      <Section title="1. 처리 목적">
        <p>환승결제는 다음 목적으로만 개인정보를 처리해요.</p>
        <ul className="list-disc pl-5">
          <li>로그인과 회원 구분</li>
          <li>찾아본 상품 기록과 즐겨찾기 기능 제공</li>
        </ul>
        <p>가격 비교는 로그인하지 않아도 쓸 수 있고, 이때는 개인정보를 받지 않아요.</p>
      </Section>

      <Section title="2. 처리 항목과 보유 기간">
        <table className="w-full border-collapse text-left text-[14px]">
          <thead>
            <tr className="text-ink">
              <th className="py-1.5 pr-2 font-bold">항목</th>
              <th className="py-1.5 pr-2 font-bold">목적</th>
              <th className="py-1.5 font-bold">보유 기간</th>
            </tr>
          </thead>
          <tbody>
            {COLLECTION_NOTICE.map((row) => (
              <tr key={row.items} className="border-t border-line align-top">
                <td className="py-2 pr-2">{row.items}</td>
                <td className="py-2 pr-2">{row.purpose}</td>
                <td className="py-2">{row.retention}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{REFUSAL_NOTICE}</p>
        <p>만 14세 미만은 가입할 수 없어요.</p>
      </Section>

      <Section title="3. 상품 사진">
        <p>
          렌즈로 찍거나 올린 사진은 상품을 찾는 데만 써요. 지금 프로토타입은 사진을 서버로 보내지 않고 이 기기 안에서만
          다루며, 앱을 닫으면 사라져요.
        </p>
        <p>
          실제 서비스의 사진 전송·보관 기간: <Todo>상품 인식 API 확정 후 기재</Todo>
        </p>
      </Section>

      <Section title="4. 파기 절차와 방법">
        <p>회원 탈퇴를 하거나 기록을 지우면 해당 정보를 바로 파기해요. 전자 파일은 복구할 수 없는 방법으로 지워요.</p>
      </Section>

      <Section title="5. 제3자 제공">
        <p>개인정보를 다른 곳에 제공하지 않아요.</p>
      </Section>

      <Section title="6. 처리 위탁과 국외 이전">
        <p>
          <Todo>클라우드(Azure) 위탁 업체·업무 내용, 데이터 저장 지역(국외 이전 여부) 확정 후 기재</Todo>
        </p>
      </Section>

      <Section title="7. 이용자의 권리와 행사 방법">
        <p>언제든 개인정보를 열람·정정·삭제하고 처리 정지와 동의 철회를 요구할 수 있어요.</p>
        <ul className="list-disc pl-5">
          <li>열람: 기록 탭 → 내 정보에서 저장된 정보와 동의 내역을 볼 수 있어요.</li>
          <li>삭제: 내 정보에서 기록을 지우거나 회원 탈퇴를 하면 바로 지워져요.</li>
          <li>그 밖의 요청은 아래 개인정보 보호책임자에게 연락해 주세요.</li>
        </ul>
      </Section>

      <Section title="8. 자동으로 저장되는 정보">
        <p>
          로그인 상태와 기록을 이 기기의 브라우저 저장소(localStorage)에, 찍은 사진을 잠시 세션 저장소(sessionStorage)에
          둬요. 광고·추적용 쿠키는 쓰지 않아요. 브라우저나 앱의 데이터 삭제로 언제든 지울 수 있어요.
        </p>
      </Section>

      <Section title="9. 안전성 확보 조치">
        <p>
          <Todo>전송 구간 암호화, 접근 권한 관리, 접속 기록 보관 등 실제 적용 조치 확정 후 기재</Todo>
        </p>
      </Section>

      <Section title="10. 개인정보 보호책임자">
        <p>
          성명·부서·연락처: <Todo>담당자 지정 후 기재</Todo>
        </p>
      </Section>

      <Section title="11. 권익 침해 구제">
        <p>개인정보 침해로 도움이 필요하면 아래 기관에 문의할 수 있어요.</p>
        <ul className="list-disc pl-5">
          <li>개인정보분쟁조정위원회: 1833-6972 (www.kopico.go.kr)</li>
          <li>개인정보침해신고센터: 118 (privacy.kisa.or.kr)</li>
          <li>대검찰청: 1301 (www.spo.go.kr)</li>
          <li>경찰청: 182 (ecrm.police.go.kr)</li>
        </ul>
      </Section>

      <Section title="12. 시행일과 변경">
        <p>
          문서 버전 {POLICY_VERSION}. 시행일: <Todo>공개일 기재</Todo>. 내용이 바뀌면 시행 7일 전에 앱에서 알려요.
        </p>
      </Section>
    </SubPage>
  );
}
