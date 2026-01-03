'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-6 text-gray-900">이용약관</h1>
        
        <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제1조 (목적)</h2>
            <p>
              본 약관은 LIMEN(이하 "서비스")이 제공하는 웹 기반 가상 머신 관리 서비스의 이용과 관련하여 
              서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제2조 (정의)</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>"서비스"란 LIMEN이 제공하는 웹 기반 가상 머신 관리 플랫폼을 의미합니다.</li>
              <li>"이용자"란 본 약관에 동의하고 서비스를 이용하는 자를 의미합니다.</li>
              <li>"VM"이란 Virtual Machine(가상 머신)을 의미합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제3조 (서비스의 제공)</h2>
            <p>
              서비스는 현재 Private Beta 단계로 운영되며, 초대를 받은 이용자만 이용할 수 있습니다.
              서비스 제공자는 서비스의 품질 향상을 위해 서비스 내용을 변경하거나 중단할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제4조 (이용자의 의무)</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>이용자는 서비스를 불법적인 목적으로 사용하여서는 안 됩니다.</li>
              <li>이용자는 서비스의 안정적 운영을 방해하는 행위를 하여서는 안 됩니다.</li>
              <li>이용자는 할당된 리소스 제한을 준수해야 합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제5조 (서비스 제한)</h2>
            <p>
              서비스는 안정적인 운영을 위해 다음과 같은 제한을 적용할 수 있습니다:
            </p>
            <ul className="list-disc list-inside space-y-2">
              <li>세션 시간 제한: 유휴 상태 시 자동 종료</li>
              <li>동시 접속 제한: 사용자별 동시 VM 접속 수 제한</li>
              <li>리소스 할당량: VM 개수, CPU, 메모리 사용량 제한</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제6조 (면책)</h2>
            <p>
              서비스 제공자는 천재지변, 전쟁, 기간통신사업자의 서비스 중지 등 불가항력으로 인한 
              서비스 중단에 대해 책임을 지지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-gray-900">제7조 (약관의 변경)</h2>
            <p>
              본 약관은 서비스 제공자의 사전 고지 없이 변경될 수 있으며, 변경된 약관은 
              서비스 내 공지사항을 통해 공지합니다.
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

