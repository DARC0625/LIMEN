'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface WaitlistFormData {
  name: string;
  organization: string;
  email: string;
  purpose?: string;
}

export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState<WaitlistFormData>({
    name: '',
    organization: '',
    email: '',
    purpose: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // Public waitlist API 사용
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const response = await fetch(`${apiUrl}/public/waitlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('대기자 등록에 실패했습니다.');
      }

      setSubmitStatus('success');
      setFormData({ name: '', organization: '', email: '', purpose: '' });
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '대기자 등록 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            LIMEN
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-4">
            브라우저로 VM 실습 환경을 제공하는 클라우드 플랫폼
          </p>
          <p className="text-sm md:text-base text-gray-600 mb-8 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg inline-block">
            🔒 Private Beta (초대 전용) · 제한된 가용성
          </p>
          
          {/* 핵심 가치 3개 */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">웹 기반 접근</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                별도 클라이언트 설치 없이 브라우저에서 바로 사용
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">실시간 환경</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                즉시 생성되는 가상 머신으로 빠른 실습 환경 제공
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">안전한 격리</h3>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                사용자별 독립된 환경으로 안전한 실습 보장
              </p>
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <button
              onClick={() => {
                const formSection = document.getElementById('waitlist-form');
                formSection?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg text-lg transition-colors shadow-lg w-full sm:w-auto"
            >
              대기자 등록
            </button>
            <Link
              href="/login"
              className="bg-gray-100 hover:bg-gray-200 text-gray-900 font-semibold px-8 py-3 rounded-lg text-lg transition-colors shadow-lg w-full sm:w-auto text-center"
            >
              로그인
            </Link>
          </div>
          
          {/* 이미 등록하신 분들을 위한 안내 */}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            이미 등록하셨나요? <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">로그인하기</Link>
          </p>
        </div>
      </section>

      {/* 제품 설명 Section */}
      <section className="container mx-auto px-4 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
            브라우저로 VM 실습 환경 제공
          </h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              LIMEN은 웹 브라우저를 통해 가상 머신(VM) 환경에 접근할 수 있는 플랫폼입니다.
              복잡한 환경 설정 없이도 즉시 실습 환경을 구축하고 사용할 수 있습니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>웹 브라우저에서 직접 VM 콘솔 접근 (noVNC)</li>
              <li>VM 생성, 시작, 중지, 삭제 등 모든 작업을 웹에서 수행</li>
              <li>다양한 OS 이미지 지원 (Ubuntu, Kali Linux, Windows 등)</li>
              <li>실시간 리소스 모니터링 및 관리</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 보안/운영 신뢰 Section */}
      <section className="container mx-auto px-4 py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
            보안 및 운영 정책
          </h2>
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">권한 관리</h3>
              <p className="text-gray-800 dark:text-gray-200 text-sm">
                역할 기반 접근 제어(RBAC)를 통해 사용자 권한을 세밀하게 관리합니다.
                모든 사용자 활동은 감사 로그에 기록됩니다.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">기록 및 감사</h3>
              <p className="text-gray-800 dark:text-gray-200 text-sm">
                모든 VM 작업, 로그인 시도, 리소스 사용 등이 감사 로그에 기록됩니다.
                보안 및 운영 모니터링을 위해 정기적으로 검토됩니다.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-700 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
              <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">제한 정책</h3>
              <p className="text-gray-800 dark:text-gray-200 text-sm">
                서비스 안정성을 위해 다음과 같은 제한이 적용됩니다:
              </p>
              <ul className="list-disc list-inside text-gray-800 dark:text-gray-200 text-sm mt-2 space-y-1">
                <li>세션 시간 제한: 유휴 상태 시 자동 종료</li>
                <li>동시 접속 제한: 사용자별 동시 VM 접속 수 제한</li>
                <li>리소스 할당량: VM 개수, CPU, 메모리 사용량 제한</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 대기자 등록 Form Section */}
      <section id="waitlist-form" className="container mx-auto px-4 py-16 bg-white dark:bg-gray-900">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-gray-100">
            대기자 등록
          </h2>
          
          {/* 이미 등록하신 분들을 위한 안내 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-center">
            <p className="text-gray-800 dark:text-gray-200 text-sm">
              이미 등록하셨거나 승인을 받으셨나요?{' '}
              <Link href="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                로그인 페이지로 이동
              </Link>
            </p>
          </div>
          
          {submitStatus === 'success' ? (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6 text-center">
              <div className="text-green-600 dark:text-green-400 text-lg font-semibold mb-2">
                등록이 완료되었습니다
              </div>
              <p className="text-gray-800 dark:text-gray-200 text-sm mb-4">
                검토 후 초대 안내를 이메일로 보내드리겠습니다.
              </p>
              <Link
                href="/login"
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded-lg text-sm transition-colors"
              >
                로그인 페이지로 이동
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label htmlFor="organization" className="block text-sm font-medium text-gray-700 mb-1">
                  소속 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="organization"
                  required
                  value={formData.organization}
                  onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="회사명 또는 학교명"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="example@email.com"
                />
              </div>

              <div>
                <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                  사용 목적 (선택)
                </label>
                <textarea
                  id="purpose"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 보안 실습, 개발 환경 테스트 등"
                />
              </div>

              {submitStatus === 'error' && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-red-600 dark:text-red-400 text-sm">{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
              >
                {isSubmitting ? '등록 중...' : '등록하기'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 문의/연락 Section */}
      <section className="container mx-auto px-4 py-16 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">문의하기</h2>
          <p className="text-gray-800 dark:text-gray-200 mb-4">
            서비스에 대한 문의사항이 있으시면 아래 채널로 연락해주세요.
          </p>
          <div className="space-y-2">
            <p className="text-gray-700 dark:text-gray-300">
              이메일: <a href="mailto:support@limen.example.com" className="text-blue-600 dark:text-blue-400 hover:underline">support@limen.example.com</a>
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              GitHub: <a href="https://github.com/DARC0625/LIMEN" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">DARC0625/LIMEN</a>
            </p>
          </div>
        </div>
      </section>

      {/* 약관/개인정보 처리방침 Section */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-3xl mx-auto text-center text-sm text-gray-700 dark:text-gray-300">
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link href="/terms" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              개인정보 처리방침
            </Link>
            <Link href="/status" className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline">
              서비스 상태
            </Link>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            © 2025 LIMEN. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
