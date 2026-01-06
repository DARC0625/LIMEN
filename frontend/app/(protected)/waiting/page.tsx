'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkAuth, isUserApproved } from '@/lib/auth';
import Loading from '@/components/Loading';

export default function WaitingPage() {
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [isApproved, setIsApproved] = useState(false);

  useEffect(() => {
    const checkApproval = async () => {
      try {
        const authResult = await checkAuth();
        if (!authResult.valid) {
          router.replace('/login');
          return;
        }

        const approved = await isUserApproved();
        setIsApproved(approved);
        
        if (approved) {
          // 승인된 사용자는 대시보드로 이동
          router.replace('/dashboard');
          return;
        }
      } catch (error) {
        console.error('Approval check failed:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkApproval();
  }, [router]);

  if (isChecking) {
    return <Loading />;
  }

  if (isApproved) {
    return null; // 리다이렉트 중
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <div className="text-6xl mb-4">⏳</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            초대 대기 중
          </h1>
          <p className="text-gray-700 mb-6">
            현재 초대 대기 상태입니다. 관리자 검토 후 초대 안내를 이메일로 보내드리겠습니다.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6 text-left">
            <h2 className="font-semibold text-lg mb-3 text-gray-900">
              다음 단계
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
              <li>관리자가 등록 정보를 검토합니다</li>
              <li>승인되면 이메일로 초대 안내를 받습니다</li>
              <li>초대 링크를 통해 서비스를 이용할 수 있습니다</li>
            </ol>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600">
              문의사항이 있으시면{' '}
              <a href="mailto:darc0625@proton.me" className="text-blue-600 hover:underline">
                darc0625@proton.me
              </a>
              으로 연락해주세요.
            </p>
          </div>

          <button
            onClick={() => router.push('/login')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            로그인 페이지로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

