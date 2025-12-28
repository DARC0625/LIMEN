# 프론트엔드 오류 해결 가이드

## 1. `exports is not defined` 오류

### 원인
Next.js 빌드 시 CommonJS와 ESM 모듈 시스템이 충돌하여 발생하는 오류입니다.

### 해결 방법

#### 방법 1: next.config.js 설정 확인
```javascript
// next.config.js
module.exports = {
  // ... 기존 설정
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  // ESM 모듈 지원
  experimental: {
    esmExternals: true,
  },
};
```

#### 방법 2: package.json 확인
```json
{
  "type": "module",  // 또는 제거
  "scripts": {
    "build": "next build"
  }
}
```

#### 방법 3: 문제가 되는 모듈 확인
- `exports is not defined` 오류가 발생하는 파일을 찾아서
- CommonJS 형식(`module.exports`)을 ESM 형식(`export`)으로 변경
- 또는 반대로 ESM을 CommonJS로 변경

#### 방법 4: Next.js 버전 확인
```bash
npm list next
# Next.js 13+ 버전 사용 권장
```

## 2. VNC WebSocket 연결 실패 (code: 1006)

### 원인
- WebSocket 업그레이드 실패
- VM UUID가 잘못되었거나 VM이 존재하지 않음
- 인증 토큰 문제
- 네트워크 연결 문제

### 해결 방법

#### 1. VM UUID 확인
프론트엔드에서 VM 목록을 가져올 때 `uuid` 필드를 사용하는지 확인:

```typescript
// 올바른 방법
const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.uuid}&token=${token}`);

// 잘못된 방법 (숫자 ID 사용)
const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.id}&token=${token}`);
```

#### 2. 인증 토큰 확인
```typescript
// 토큰이 유효한지 확인
const token = localStorage.getItem('token');
if (!token) {
  // 로그인 페이지로 리다이렉트
  router.push('/login');
}
```

#### 3. WebSocket 연결 에러 처리
```typescript
const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.uuid}&token=${token}`);

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  // 에러 메시지 표시
};

ws.onclose = (event) => {
  console.log('WebSocket closed:', event.code, event.reason);
  if (event.code === 1006) {
    // 연결이 비정상적으로 종료됨
    // 재연결 시도 또는 에러 메시지 표시
  }
};
```

#### 4. 백엔드 로그 확인
```bash
tail -f /home/darc0/projects/LIMEN/backend/server.log | grep -E "(vnc|VNC|websocket)"
```

#### 5. CORS 설정 확인
백엔드의 `ALLOWED_ORIGINS`에 `https://limen.kr`이 포함되어 있는지 확인:

```bash
grep ALLOWED_ORIGINS /home/darc0/projects/LIMEN/backend/.env
```

## 3. 대시보드 연결 상태 오프라인

### 원인
- 프론트엔드가 백엔드 API를 호출하지 못함
- API 엔드포인트 경로 오류
- 인증 토큰 문제

### 해결 방법

#### 1. API 엔드포인트 확인
```typescript
// Health Check
const response = await fetch('https://limen.kr/api/health');
const data = await response.json();
console.log('Health:', data);
```

#### 2. 네트워크 요청 확인
브라우저 개발자 도구의 Network 탭에서:
- `/api/health` 요청이 있는지 확인
- 응답 상태 코드 확인 (200 OK 여부)
- CORS 오류가 있는지 확인

#### 3. 백엔드 서버 상태 확인
```bash
curl https://limen.kr/api/health
# 응답: {"db":"connected","libvirt":"connected","status":"ok",...}
```

#### 4. 프론트엔드 API 호출 코드 확인
```typescript
// 올바른 방법
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://limen.kr';
const response = await fetch(`${API_BASE_URL}/api/health`);

// 잘못된 방법 (상대 경로가 잘못된 경우)
const response = await fetch('/api/health'); // Next.js rewrites 확인 필요
```

## 4. 일반적인 디버깅 방법

### 브라우저 개발자 도구
1. **Console 탭**: JavaScript 오류 확인
2. **Network 탭**: API 요청/응답 확인
3. **Application 탭**: LocalStorage, SessionStorage 확인 (토큰 저장 여부)

### 백엔드 로그 확인
```bash
# 실시간 로그 확인
tail -f /home/darc0/projects/LIMEN/backend/server.log

# 특정 오류 검색
grep -i "error\|fatal\|panic" /home/darc0/projects/LIMEN/backend/server.log | tail -20
```

### 프론트엔드 빌드 확인
```bash
cd /path/to/frontend
npm run build
# 빌드 오류 확인
```

## 관련 문서

- [프론트엔드 UUID 마이그레이션 가이드](./FRONTEND_UUID_MIGRATION.md)
- [백엔드 API 문서](../../docs/API_DOCUMENTATION.md)

