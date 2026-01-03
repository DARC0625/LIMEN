'use client';

import AuthGuard from '../../components/AuthGuard';
import { VersionInfo } from '../../components/VersionInfo';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthGuard>{children}</AuthGuard>
      <VersionInfo />
    </>
  );
}


