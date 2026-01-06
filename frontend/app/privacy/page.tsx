'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">개인정보 처리방침</h1>
        
        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제1조 (개인정보의 처리 목적)</h2>
            <p>
              LIMEN(이하 "서비스")은 다음의 목적을 위하여 개인정보를 처리합니다:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>서비스 제공 및 계약의 이행</li>
              <li>이용자 인증 및 권한 관리</li>
              <li>서비스 개선 및 신규 서비스 개발</li>
              <li>보안 및 부정 이용 방지</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제2조 (처리하는 개인정보의 항목)</h2>
            <p>서비스는 다음의 개인정보 항목을 처리합니다:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>필수 항목: 사용자명, 비밀번호(암호화), 이메일 주소</li>
              <li>선택 항목: 소속, 사용 목적</li>
              <li>자동 수집 항목: IP 주소, 접속 로그, 세션 정보</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <p>
              서비스는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 
              동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>회원 정보: 회원 탈퇴 시까지 (단, 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관)</li>
              <li>로그 정보: 1년</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제4조 (개인정보의 제3자 제공)</h2>
            <p>
              서비스는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 
              다만, 다음의 경우에는 예외로 합니다:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제5조 (개인정보의 파기)</h2>
            <p>
              서비스는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 
              지체 없이 해당 개인정보를 파기합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제6조 (정보주체의 권리·의무 및 행사방법)</h2>
            <p>
              이용자는 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다.
              권리 행사는 서비스 제공자에게 서면, 전자우편 등을 통하여 하실 수 있으며, 
              서비스 제공자는 이에 대해 지체 없이 조치하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제7조 (개인정보 보호책임자)</h2>
            <p>
              서비스는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 
              정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mt-2">
              <p className="font-semibold">개인정보 보호책임자</p>
              <p>이메일: darc0625@proton.me</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제8조 (개인정보 처리방침 변경)</h2>
            <p>
              이 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 
              삭제 및 정정이 있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <Link href="/" className="text-blue-600 hover:text-blue-700 hover:underline">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}





