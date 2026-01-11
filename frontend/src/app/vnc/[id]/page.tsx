'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const VNCViewer = dynamic(
  () => import('@/components/VNCViewer').then((mod) => mod.default),
  { ssr: false }
);

export default function VNCPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) return <div>Invalid VM ID</div>;

  return <VNCViewer uuid={id} />;
}
