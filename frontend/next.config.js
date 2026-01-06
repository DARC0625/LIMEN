/** @type {import('next').NextConfig} */

// Backend and Agent URLs - 서버 사이드 rewrites 전용 (환경 변수 또는 기본값)
// ⚠️ 중요: 백엔드는 10.0.0.100, 프론트엔드는 10.0.0.10
// 클라이언트 코드에서는 상대 경로만 사용하므로, 이 값은 Next.js rewrites에서만 사용됨
// 환경 변수가 없으면 기본값 사용 (배포 환경에서는 반드시 환경 변수 설정 필요)
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://10.0.0.100:18443';
const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || process.env.AGENT_URL || 'http://10.0.0.100:9000';

const nextConfig = {
  // 빌드 ID 생성: 파일 내용 기반 해시 사용 (안정적인 캐시 버스팅)
  // 매 빌드마다 변경되지만, 동일한 소스코드면 동일한 ID 생성
  generateBuildId: async () => {
    const fs = require('fs');
    const path = require('path');
    const crypto = require('crypto');
    
    try {
      // package.json과 주요 설정 파일의 해시를 기반으로 빌드 ID 생성
      const filesToHash = [
        'package.json',
        'next.config.js',
        'tsconfig.json',
      ];
      
      let combinedHash = '';
      for (const file of filesToHash) {
        const filePath = path.join(process.cwd(), file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf8');
          combinedHash += crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
        }
      }
      
      // 타임스탬프도 포함하여 빌드마다 고유성 보장
      const timestamp = Date.now();
      const finalHash = crypto.createHash('md5')
        .update(`${combinedHash}-${timestamp}`)
        .digest('hex')
        .substring(0, 12);
      
      return `build-${finalHash}`;
    } catch (error) {
      // 에러 발생 시 타임스탬프 기반으로 폴백
      const timestamp = Date.now();
      const hash = crypto.createHash('md5').update(`${timestamp}`).digest('hex').substring(0, 8);
      return `build-${timestamp}-${hash}`;
    }
  },
  
  // 성능 최적화
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false, // 보안: X-Powered-By 헤더 제거
  
  // 이미지 최적화: WebP/AVIF 포맷 자동 변환
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // 1.7.0-beta는 ESM 모듈이므로 transpilePackages에 추가하여 Next.js가 처리하도록 함
  // serverExternalPackages와 충돌하므로 제거
  transpilePackages: ['@novnc/novnc'],
  
  // Bundle optimization: Split large chunks
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      // 클라이언트 사이드에서 process 객체 정의
      // Next.js는 기본적으로 process.env.NODE_ENV를 치환하지만, process 객체 자체가 필요할 수 있음
      config.resolve.fallback = {
        ...config.resolve.fallback,
        process: 'process/browser',
      };
      
      // 극한의 번들 최적화: 더 세밀한 코드 스플리팅
      config.optimization = {
        ...config.optimization,
        usedExports: true, // Tree shaking 활성화
        sideEffects: false, // 사이드 이펙트 없는 모듈 최적화
        splitChunks: {
          chunks: 'all',
          minSize: 20000, // 20KB 이상만 별도 청크로 분리
          maxSize: 244000, // 244KB 이상이면 분할
          cacheGroups: {
            default: false,
            vendors: false,
            // Separate noVNC into its own chunk (largest dependency)
            novnc: {
              name: 'novnc',
              test: /[\\/]node_modules[\\/]@novnc[\\/]/,
              priority: 30,
              reuseExistingChunk: true,
              enforce: true, // 강제 분리
            },
            // Separate React Query
            reactQuery: {
              name: 'react-query',
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
              priority: 25,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Framework chunk (React, Next.js)
            framework: {
              name: 'framework',
              test: /[\\/]node_modules[\\/](react|react-dom|next|scheduler)[\\/]/,
              priority: 20,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Common vendor chunk (기타 node_modules)
            vendor: {
              name: 'vendor',
              test: /[\\/]node_modules[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
              minChunks: 2, // 2개 이상에서 사용되는 모듈만
            },
          },
        },
      };
    }
    return config;
  },
  
  
  // ⚠️ Turbopack 전용 설정 (Webpack 사용 금지)
  // Turbopack은 Webpack보다 훨씬 빠르고 최신 기술 사용
  // CSS 자동 로드는 layout.tsx의 클라이언트 스크립트로 제거
  // Webpack 설정은 절대 추가하지 말 것!
  
  // 개발 모드에서 프록시를 통한 접근 허용
  allowedDevOrigins: ['www.darc.kr', 'darc.kr', 'limen.kr', 'www.limen.kr'],
  
  // 번들 최적화
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // 프로덕션에서도 error와 warn 유지 (디버깅 필요)
    } : false,
  },
  
  // 성능 최적화: 실험적 기능
  experimental: {
    optimizePackageImports: ['@tanstack/react-query'], // React Query 트리 쉐이킹 최적화
  },
  
  // 프로덕션 최적화
  // swcMinify: true, // Next.js 16에서는 기본적으로 활성화되어 있음 (제거)
  
  // 외부 리소스 자동 최적화 비활성화 (rfb.css 등 불필요한 리소스 제거)
  // optimizePackageImports는 Next.js 15+에서만 사용 가능하므로 주석 처리
  // optimizePackageImports: ['@novnc/novnc'],
  
  // 출력 최적화
  // output: 'standalone', // standalone 모드는 정적 파일 서빙에 문제가 있을 수 있음
  
  // 이미지 최적화
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.darc.kr',
      },
      {
        protocol: 'https',
        hostname: 'darc.kr',
      },
      {
        protocol: 'https',
        hostname: 'limen.kr',
      },
      {
        protocol: 'https',
        hostname: 'www.limen.kr',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  // 보안 헤더 설정
  async headers() {
    return [
      {
        // JavaScript 파일에 대한 헤더 - MIME 타입 명시
        source: '/_next/static/chunks/:path*.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            // 정적 파일 캐싱 활성화 (1년, 빌드 ID로 버전 관리)
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
      {
        // CSS 파일에 대한 헤더 - MIME 타입 명시
        source: '/_next/static/:path*.css',
        headers: [
          {
            key: 'Content-Type',
            value: 'text/css; charset=utf-8',
          },
          {
            // 정적 파일 캐싱 활성화 (1년, 빌드 ID로 버전 관리)
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 기타 정적 파일에 대한 헤더 (이미지, 폰트 등)
        source: '/_next/static/:path*',
        headers: [
          {
            // 정적 파일 캐싱 활성화 (1년, 빌드 ID로 버전 관리)
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // 모든 HTML 페이지에 대한 캐시 방지 헤더
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
      {
        // 모든 경로에 대한 보안 헤더
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss: http: https:; frame-ancestors 'none';",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
        ],
      },
    ];
  },
  
  // ⚠️ Turbopack 전용 설정 (Webpack 사용 금지)
  // Turbopack은 Webpack보다 훨씬 빠르고 최신 기술 사용
  // CSS 자동 로드는 layout.tsx의 클라이언트 스크립트로 제거
  turbopack: {
    resolveExtensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.mjs'],
    // ESM 모듈 resolve를 위해 package.json의 exports 필드가 제대로 처리되도록 함
    // resolveAlias는 상대 경로만 지원하므로 제거
  },
  
  // ⚠️ Webpack 설정 절대 추가 금지! Turbopack만 사용!
  // rfb.css는 layout.tsx의 클라이언트 스크립트로 제거됨
  
  // API 프록시 설정은 middleware.ts에서 처리
  // ⚠️ 중요: Next.js rewrites는 외부 URL을 지원하지 않음 (같은 서버 내부 경로만 지원)
  // 외부 URL 프록시는 middleware를 사용해야 함
  // async rewrites() {
  //   // middleware.ts에서 처리
  // },
};

// 번들 분석기 설정 (선택적)
let config = nextConfig;
if (process.env.ANALYZE === 'true') {
  try {
    const withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: true,
    });
    config = withBundleAnalyzer(nextConfig);
  } catch (e) {
    console.warn('Bundle analyzer not available, skipping...');
  }
}

module.exports = config;








