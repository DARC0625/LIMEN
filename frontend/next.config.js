/** @type {import('next').NextConfig} */
const nextConfig = {
  // ✅ P1-Next-Fix-Module-4F: Standalone output for Docker
  output: 'standalone',
  
  // 빌드 ID를 타임스탬프 기반으로 생성하여 캐시 무효화 보장
  generateBuildId: async () => {
    // 타임스탬프 기반 빌드 ID 생성 (매 빌드마다 새로운 ID)
    // 이렇게 하면 정적 파일 URL이 변경되어 브라우저 캐시가 무효화됨
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `build-${timestamp}-${random}`;
  },
  
  // 정적 파일 캐싱 설정
  async headers() {
    return [
      {
        // 정적 파일에 대한 캐시 헤더
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            // immutable 파일은 해시가 변경되므로 장기 캐시 가능
            // 하지만 빌드 ID가 변경되면 자동으로 새 파일이 로드됨
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
  
  // 개발 환경에서 캐시 비활성화 (선택사항)
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),
};

module.exports = nextConfig;
