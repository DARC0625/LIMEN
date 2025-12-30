# 프록시 설정 문제 해결 가이드

## 문제 상황

Next.js의 `rewrites` 설정에서 `destination`이 잘못 변환됨:
- **원래 설정**: `destination: http://localhost:18443/api/:path*`
- **빌드된 설정**: `destination: /api/api/:path*` (잘못됨)
- **결과**: 모든 API 요청이 404 반환

## 원인

Next.js의 `rewrites`에서 `destination`에 상대 경로를 사용하면, Next.js가 자동으로 `/api` prefix를 추가하여 `/api/api/`로 중복됩니다.

## 해결 방법

### 방법 1: 외부 URL 사용 (권장)

`next.config.js` 또는 `next.config.ts`에서 외부 URL을 사용:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:18443/api/:path*', // 외부 URL 사용
      },
    ];
  },
};

module.exports = nextConfig;
```

또는 TypeScript:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:18443/api/:path*', // 외부 URL 사용
      },
    ];
  },
};

export default nextConfig;
```

### 방법 2: 환경 변수 사용 (프로덕션 대응)

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:18443';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
```

환경 변수 설정 (`.env.local`):
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:18443
```

프로덕션 환경 (`.env.production`):
```
NEXT_PUBLIC_BACKEND_URL=https://api.limen.kr
```

### 방법 3: WebSocket 프록시 설정

VNC WebSocket 연결을 위한 추가 설정:

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:18443';
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
      {
        source: '/vnc',
        destination: `${backendUrl}/vnc`,
      },
    ];
  },
};

export default nextConfig;
```

## 확인 사항

### 1. 백엔드 상태 확인

```bash
cd /home/darc0/projects/LIMEN
./scripts/start-limen.sh status
```

백엔드가 실행 중이어야 합니다:
- ✓ Backend: running
- ✓ Backend (18443): listening

### 2. 백엔드 직접 테스트

```bash
curl http://localhost:18443/api/health
```

예상 응답:
```json
{"db":"connected","libvirt":"connected","status":"ok","time":"..."}
```

### 3. Next.js 개발 서버 재시작

설정 변경 후 반드시 재시작:

```bash
# 개발 서버
npm run dev

# 또는 프로덕션 빌드
npm run build
npm start
```

### 4. 브라우저에서 테스트

개발자 도구 > Network 탭에서:
- `/api/health` 요청이 `http://localhost:18443/api/health`로 프록시되는지 확인
- 응답이 200 OK인지 확인
- `/api/api/health`로 요청되지 않는지 확인

## 주의사항

1. **상대 경로 사용 금지**: `destination: '/api/:path*'` ❌
2. **외부 URL 사용**: `destination: 'http://localhost:18443/api/:path*'` ✅
3. **환경 변수 활용**: 개발/프로덕션 환경 분리
4. **WebSocket 지원**: VNC WebSocket도 프록시 설정 필요

## 추가 디버깅

### Next.js 빌드 로그 확인

```bash
npm run build 2>&1 | grep -i "rewrite\|proxy\|destination"
```

### 런타임 프록시 확인

브라우저 개발자 도구 > Network 탭:
- 요청 URL 확인
- 응답 헤더 확인
- 프록시된 destination 확인

### 백엔드 로그 확인

```bash
tail -f backend/logs/server.log | grep -i "api\|health"
```

## 참고

- [Next.js Rewrites Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/rewrites)
- 백엔드 API 라우팅: `/api/*` (router.go)
- WebSocket 라우팅: `/ws/*`, `/vnc` (router.go)


