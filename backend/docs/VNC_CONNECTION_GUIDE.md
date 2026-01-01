# VNC WebSocket 연결 가이드

## 개요

VNC 콘솔에 접근하기 위한 WebSocket 연결 방법을 설명합니다.

## 지원하는 엔드포인트

- `GET /ws/vnc` - WebSocket 경로
- `GET /vnc` - 대체 경로 (Envoy 호환성)
- `GET /vnc/{uuid}` - Path parameter로 UUID 전달 (권장)

## 인증 방법

VNC WebSocket 연결은 다음 순서로 인증을 시도합니다:

1. **Query parameter**: `?token=...` (하위 호환)
2. **Authorization header**: `Authorization: Bearer ...` (권장)
3. **refresh_token cookie**: 쿠키에서 자동으로 access token 생성 (세션 기반)

## 올바른 URL 형식

### ✅ 권장 방법 1: Path parameter + Authorization header

```javascript
const ws = new WebSocket(
  `wss://limen.kr/vnc/${vmUUID}`,
  [],
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

**장점**:
- URL이 깔끔함
- 토큰이 URL에 노출되지 않음
- 보안상 가장 안전

### ✅ 권장 방법 2: Path parameter + Cookie

```javascript
const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}`);
// 쿠키는 자동으로 전송됨 (credentials: 'include' 필요)
```

**장점**:
- 간단함
- 쿠키가 자동으로 전송됨
- 세션 기반 인증

### ✅ 하위 호환: Query parameter

```javascript
const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}?token=${accessToken}`);
```

**주의**: 
- 토큰이 URL에 노출됨 (보안상 권장하지 않음)
- 브라우저 히스토리에 토큰이 남을 수 있음

## ❌ 잘못된 URL 형식

### 잘못된 예시 1: Path에 & 사용

```javascript
// ❌ 잘못됨
const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}&token=${accessToken}`);
```

**문제점**:
- `&`는 query parameter 구분자이지 path 구분자가 아님
- URL 파싱 오류 발생
- WebSocket 연결 실패

**올바른 형식**:
```javascript
// ✅ 올바름
const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}?token=${accessToken}`);
```

### 잘못된 예시 2: Path에 token 직접 포함

```javascript
// ❌ 잘못됨
const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}/token/${accessToken}`);
```

**문제점**:
- 백엔드가 `/vnc/{uuid}/token/{token}` 경로를 지원하지 않음
- 인증 실패

**올바른 형식**:
```javascript
// ✅ 올바름 - Authorization header 사용
const ws = new WebSocket(
  `wss://limen.kr/vnc/${vmUUID}`,
  [],
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  }
);
```

## 프론트엔드 구현 예시

### React/Next.js 예시

```typescript
import { useEffect, useRef } from 'react';

function VNCViewer({ vmUUID, accessToken }: { vmUUID: string; accessToken: string }) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 방법 1: Authorization header 사용 (권장)
    const ws = new WebSocket(
      `wss://limen.kr/vnc/${vmUUID}`,
      [],
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    // 방법 2: Query parameter 사용 (하위 호환)
    // const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}?token=${accessToken}`);

    ws.onopen = () => {
      console.log('VNC WebSocket connected');
    };

    ws.onerror = (error) => {
      console.error('VNC WebSocket error:', error);
    };

    ws.onclose = (event) => {
      console.log('VNC WebSocket closed:', event.code, event.reason);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
    };
  }, [vmUUID, accessToken]);

  return <div>VNC Viewer</div>;
}
```

### Vanilla JavaScript 예시

```javascript
function connectVNC(vmUUID, accessToken) {
  // 방법 1: Authorization header 사용 (권장)
  const ws = new WebSocket(
    `wss://limen.kr/vnc/${vmUUID}`,
    [],
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  // 방법 2: Query parameter 사용
  // const ws = new WebSocket(`wss://limen.kr/vnc/${vmUUID}?token=${accessToken}`);

  ws.onopen = () => {
    console.log('VNC WebSocket connected');
  };

  ws.onerror = (error) => {
    console.error('VNC WebSocket error:', error);
  };

  ws.onclose = (event) => {
    console.log('VNC WebSocket closed:', event.code, event.reason);
  };

  return ws;
}
```

## WebSocket 헤더 전달 주의사항

일부 브라우저나 WebSocket 라이브러리는 WebSocket 연결 시 커스텀 헤더를 지원하지 않을 수 있습니다. 이 경우:

1. **쿠키 사용**: 쿠키는 자동으로 전송되므로 가장 간단한 방법
2. **Query parameter 사용**: 헤더를 지원하지 않는 경우 대안
3. **프록시 사용**: 프론트엔드 프록시에서 헤더를 추가

## 에러 처리

### 연결 실패 시 확인 사항

1. **URL 형식 확인**
   - ✅ 올바른 형식: `wss://limen.kr/vnc/{uuid}?token=...`
   - ❌ 잘못된 형식: `wss://limen.kr/vnc/{uuid}&token=...`

2. **인증 토큰 확인**
   - Access token이 유효한지 확인
   - 토큰이 만료되지 않았는지 확인
   - refresh_token 쿠키가 있는지 확인

3. **WebSocket 업그레이드 확인**
   - `Upgrade: websocket` 헤더가 전송되는지 확인
   - `Connection: Upgrade` 헤더가 전송되는지 확인

4. **CORS 설정 확인**
   - Origin이 허용된 목록에 있는지 확인
   - `Access-Control-Allow-Credentials: true` 헤더 확인

## 백엔드 로그 확인

VNC 연결 시도 시 백엔드 로그에서 다음을 확인할 수 있습니다:

```bash
tail -f /tmp/limen-server.log | grep -E "(VNC|vnc|WebSocket)"
```

로그에서 확인할 내용:
- `VNC WebSocket connection attempt - DETAILED`: 연결 시도 정보
- `VNC authentication via ...`: 인증 방법
- `VNC connection request`: VM UUID 추출 성공
- `WebSocket accept SUCCESS`: WebSocket 업그레이드 성공

## 참고 자료

- [API 문서](./API_DOCUMENTATION.md#vnc-콘솔)
- [인증 시스템 문서](./AUTHENTICATION.md#vnc-websocket-인증)

