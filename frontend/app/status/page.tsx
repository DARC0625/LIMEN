'use client';

import { useEffect, useState } from 'react';
import { VersionInfo } from '@/components/VersionInfo';

interface ServiceStatus {
  status: 'operational' | 'degraded' | 'outage';
  message: string;
  lastUpdated: string;
}

export default function StatusPage() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    status: 'operational',
    message: '모든 시스템이 정상 작동 중입니다.',
    lastUpdated: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
        const response = await fetch(`${apiUrl}/health`);
        
        if (response.ok) {
          const data = await response.json();
          setServiceStatus({
            status: data.status || 'operational',
            message: data.message || '모든 시스템이 정상 작동 중입니다.',
            lastUpdated: new Date().toISOString(),
          });
        } else {
          setServiceStatus({
            status: 'degraded',
            message: '일부 서비스에 문제가 있을 수 있습니다.',
            lastUpdated: new Date().toISOString(),
          });
        }
      } catch {
        setServiceStatus({
          status: 'outage',
          message: '서비스 상태를 확인할 수 없습니다.',
          lastUpdated: new Date().toISOString(),
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    // 30초마다 상태 업데이트
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusColors = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    outage: 'bg-red-500',
  };

  const statusLabels = {
    operational: '정상',
    degraded: '부분 장애',
    outage: '장애',
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900">
          서비스 상태
        </h1>

        {isLoading ? (
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">상태 확인 중...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 상태 카드 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">시스템 상태</h2>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${statusColors[serviceStatus.status]}`}></div>
                  <span className="font-medium text-gray-700">
                    {statusLabels[serviceStatus.status]}
                  </span>
                </div>
              </div>
              <p className="text-gray-700 mb-4">{serviceStatus.message}</p>
              <p className="text-sm text-gray-500">
                마지막 업데이트: {new Date(serviceStatus.lastUpdated).toLocaleString('ko-KR')}
              </p>
            </div>

            {/* 서비스 구성 요소 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-900">서비스 구성 요소</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">API 서버</span>
                  <span className="text-green-600 font-medium">정상</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">데이터베이스</span>
                  <span className="text-green-600 font-medium">정상</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">VM 관리 시스템</span>
                  <span className="text-green-600 font-medium">정상</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">VNC 콘솔</span>
                  <span className="text-green-600 font-medium">정상</span>
                </div>
              </div>
            </div>

            {/* 알림 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                서비스 상태에 문제가 있거나 문의사항이 있으시면{' '}
                <a href="mailto:darc0625@proton.me" className="text-blue-600 hover:underline">
                  darc0625@proton.me
                </a>
                으로 연락해주세요.
              </p>
            </div>
          </div>
        )}

        <div className="mt-8">
          <VersionInfo />
        </div>
      </div>
    </div>
  );
}





