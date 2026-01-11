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
        throw new Error('등록 처리 중 오류가 발생했습니다.');
      }

      setSubmitStatus('success');
      setFormData({ name: '', organization: '', email: '', purpose: '' });
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '등록 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
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
            웹 기반 가상화 인프라 관리 플랫폼
          </p>
          <p className="text-sm md:text-base text-gray-600 mb-8 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg inline-block">
            Private Beta · 초대 전용 서비스
          </p>
          
          {/* 핵심 가치 3개 */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">웹 기반 접근</h3>
              <p className="text-gray-700 text-sm">
                클라이언트 설치 없이 브라우저를 통한 원격 접근 지원
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">즉시 프로비저닝</h3>
              <p className="text-gray-700 text-sm">
                가상 머신 인스턴스의 신속한 생성 및 배포
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <div className="text-3xl mb-3">🔒</div>
              <h3 className="font-semibold text-lg mb-2 text-gray-900">리소스 격리</h3>
              <p className="text-gray-700 text-sm">
                사용자별 독립된 네트워크 및 스토리지 환경 제공
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
              className="bg-cyan-600 hover:bg-cyan-700 text-white font-semibold px-8 py-3 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto"
            >
              대기자 등록
            </button>
            <Link
              href="/login"
              className="bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold px-8 py-3 rounded-xl text-lg transition-all duration-200 shadow-lg hover:shadow-xl w-full sm:w-auto text-center"
            >
              로그인
            </Link>
          </div>
        </div>
      </section>

      {/* 제품 설명 Section */}
      <section className="container mx-auto px-4 py-16 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
            웹 기반 가상화 인프라 관리
          </h2>
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 mb-4">
              LIMEN은 웹 인터페이스를 통해 가상 머신 인스턴스를 생성, 관리, 모니터링할 수 있는 클라우드 플랫폼입니다.
              별도의 클라이언트 소프트웨어 설치 없이 브라우저만으로 전체 인프라를 제어할 수 있습니다.
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>웹 기반 VNC 콘솔을 통한 원격 데스크톱 접근</li>
              <li>가상 머신 라이프사이클 관리 (생성, 시작, 중지, 삭제)</li>
              <li>다양한 운영체제 템플릿 지원 (Ubuntu, Kali Linux, Windows)</li>
              <li>실시간 리소스 사용량 모니터링 및 할당량 관리</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 보안/운영 신뢰 Section */}
      <section className="container mx-auto px-4 py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
            보안 및 운영 정책
          </h2>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-2 text-gray-900">접근 제어</h3>
              <p className="text-gray-800 text-sm">
                역할 기반 접근 제어(RBAC)를 통한 세분화된 권한 관리 및 모든 사용자 활동의 감사 로그 기록을 제공합니다.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-2 text-gray-900">감사 및 모니터링</h3>
              <p className="text-gray-800 text-sm">
                가상 머신 작업, 인증 시도, 리소스 할당 등 모든 시스템 이벤트를 감사 로그에 기록하며, 보안 및 운영 모니터링을 위해 정기적으로 검토합니다.
              </p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-semibold text-lg mb-2 text-gray-900">리소스 제한</h3>
              <p className="text-gray-800 text-sm">
                서비스 안정성 및 공정한 리소스 배분을 위해 다음 제한이 적용됩니다:
              </p>
              <ul className="list-disc list-inside text-gray-800 text-sm mt-2 space-y-1">
                <li>세션 타임아웃: 유휴 상태 지속 시 자동 세션 종료</li>
                <li>동시 접속 제한: 사용자별 동시 가상 머신 접속 수 제한</li>
                <li>할당량 관리: 가상 머신 수, CPU 코어, 메모리 사용량 제한</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 대기자 등록 Form Section */}
      <section id="waitlist-form" className="container mx-auto px-4 py-16 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900">
            대기자 등록
          </h2>
          
          
          {submitStatus === 'success' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-green-600 text-lg font-semibold mb-2">
                등록이 완료되었습니다
              </div>
              <p className="text-gray-800 text-sm">
                검토 후 초대 안내를 이메일로 발송해드립니다.
              </p>
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="이름을 입력하세요"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="소속 기관명을 입력하세요"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                  placeholder="사용 목적을 입력하세요 (선택사항)"
                />
              </div>

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-600 text-sm">{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-400 text-white font-semibold px-6 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none font-medium"
              >
                {isSubmitting ? '등록 중...' : '등록하기'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* 문의/연락 Section */}
      <section className="container mx-auto px-4 py-16 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-900">문의</h2>
          <p className="text-gray-800 mb-4">
            서비스 관련 문의사항은 아래 채널을 통해 연락주시기 바랍니다.
          </p>
          <div className="space-y-2">
            <p className="text-gray-700">
              이메일: <a href="mailto:darc0625@proton.me" className="text-blue-600 hover:underline">darc0625@proton.me</a>
            </p>
            <p className="text-gray-700">
              GitHub: <a href="https://github.com/DARC0625/LIMEN" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">DARC0625/LIMEN</a>
            </p>
          </div>
        </div>
      </section>

      {/* 약관/개인정보 처리방침 Section */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-200">
        <div className="max-w-3xl mx-auto text-center text-sm text-gray-700">
          <div className="flex flex-wrap justify-center gap-4 mb-4">
            <Link href="/terms" className="hover:text-blue-600 hover:underline">
              이용약관
            </Link>
            <Link href="/privacy" className="hover:text-blue-600 hover:underline">
              개인정보 처리방침
            </Link>
            <Link href="/status" className="hover:text-blue-600 hover:underline">
              서비스 상태
            </Link>
          </div>
          <p className="text-gray-600">
            © 2025 LIMEN. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
