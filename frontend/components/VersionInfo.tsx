'use client';

import { useEffect, useState } from 'react';

interface VersionInfo {
  version: string;
  commitHash: string;
  buildTime?: string;
}

export function VersionInfo() {
  const [version, setVersion] = useState<VersionInfo | null>(null);

  useEffect(() => {
    // 환경 변수에서 버전 정보 가져오기
    const versionInfo: VersionInfo = {
      version: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
      commitHash: process.env.NEXT_PUBLIC_COMMIT_HASH || 'unknown',
      buildTime: process.env.NEXT_PUBLIC_BUILD_TIME,
    };
    setVersion(versionInfo);
  }, []);

  if (!version) {
    return null;
  }

  return (
    <div className="text-xs text-gray-500 text-center py-2">
      <div className="space-x-2">
        <span>v{version.version}</span>
        {version.commitHash !== 'unknown' && (
          <span className="font-mono">({version.commitHash.substring(0, 7)})</span>
        )}
        {version.buildTime && (
          <span className="text-gray-400">{new Date(version.buildTime).toLocaleDateString()}</span>
        )}
      </div>
      <div className="mt-1">
        <a
          href="/status"
          className="text-blue-600 hover:text-blue-700 hover:underline"
        >
          서비스 상태
        </a>
        {' | '}
        <a
          href="https://github.com/DARC0625/LIMEN"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-700 hover:underline"
        >
          문서
        </a>
      </div>
    </div>
  );
}


