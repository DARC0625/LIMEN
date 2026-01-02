'use client';

// 동적 렌더링 강제
export const dynamic = 'force-dynamic';

import dynamicImport from 'next/dynamic';
import { useParams } from 'next/navigation';
import Loading from '@/components/Loading';

// 동적 import: VNCViewer는 무거운 컴포넌트이므로 코드 스플리팅 적용
const VNCViewer = dynamicImport(
  () => import('@/components/VNCViewer').then((mod) => mod.default),
  {
    loading: () => <Loading message="Loading VNC console..." size="lg" />,
    ssr: false, // 클라이언트 사이드만 렌더링 (noVNC는 브라우저 전용)
  }
);

export default function VNCPage() {
  const params = useParams();
  const uuid = params?.uuid as string;

  if (!uuid) return <div>Invalid VM UUID</div>;

  return <VNCViewer uuid={uuid} />;
}
