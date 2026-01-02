# 프론트엔드 개발자 가이드

> [← 홈](../../00-home.md) | [프론트엔드](../) | [가이드](./) | [개발자 가이드](./FRONTEND_DEVELOPER_GUIDE.md)

## ⚠️ 참고사항

이 문서는 과거 프론트엔드 개발 시 작성된 가이드입니다. 현재 LIMEN 프로젝트는 프론트엔드가 제거된 백엔드 전용 구조입니다. 향후 프론트엔드 재구축 시 참고용으로 보관됩니다.

---

## 개요

LIMEN 프론트엔드 개발을 위한 완전한 API 및 통합 가이드입니다.

---

## 📋 목차

1. [API 엔드포인트 목록](#1-api-엔드포인트-목록)
2. [인증/인가 방식](#2-인증인가-방식)
3. [WebSocket 연결](#3-websocket-연결)
4. [Agent 서버](#4-agent-서버)
5. [데이터 모델](#5-데이터-모델)
6. [CORS 및 보안](#6-cors-및-보안)
7. [리버스 프록시](#7-리버스-프록시)
8. [환경 변수](#8-환경-변수)
9. [에러 처리](#9-에러-처리)
10. [예제 코드](#10-예제-코드)

---

## 1. API 엔드포인트 목록

### Base URL

**프로덕션:**
```
https://www.darc.kr/api
```

**개발:**
```
http://localhost:18443/api
```

### 공개 엔드포인트 (인증 불필요)

#### 헬스 체크
```http
GET /api/health
```

**응답:**
```json
{
  "status": "ok",
  "time": "2024-12-23T20:30:00+09:00",
  "db": "connected"
}
```

#### 로그인
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

#### 회원가입
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password",
  "email": "user@example.com"
}
```

### 보호된 엔드포인트 (인증 필요)

모든 보호된 엔드포인트는 `Authorization: Bearer <token>` 헤더가 필요합니다.

#### VM 관리
- `GET /api/vms` - VM 목록 조회
- `POST /api/vms` - VM 생성
- `POST /api/vms/{id}/action` - VM 액션 (start/stop/restart/delete/resize)
- `GET /api/vms/{id}/stats` - VM 통계 조회

#### 스냅샷 관리
- `GET /api/vms/{id}/snapshots` - 스냅샷 목록
- `POST /api/vms/{id}/snapshots` - 스냅샷 생성
- `POST /api/snapshots/{id}/restore` - 스냅샷 복원
- `DELETE /api/snapshots/{id}` - 스냅샷 삭제

#### 할당량 관리
- `GET /api/quota` - 할당량 조회
- `PUT /api/quota` - 할당량 업데이트 (Admin만)

#### 사용자 관리 (Admin만)
- `GET /api/admin/users` - 사용자 목록
- `POST /api/admin/users` - 사용자 생성
- `GET /api/admin/users/{id}` - 사용자 조회
- `PUT /api/admin/users/{id}` - 사용자 업데이트
- `DELETE /api/admin/users/{id}` - 사용자 삭제
- `PUT /api/admin/users/{id}/role` - 역할 변경
- `PUT /api/admin/users/{id}/approve` - 사용자 승인

---

## 2. 인증/인가 방식

### JWT 토큰

모든 보호된 API는 JWT 토큰을 사용합니다.

### 토큰 획득

```typescript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'admin',
    password: 'password',
  }),
});

const data = await response.json();
const token = data.token;
localStorage.setItem('auth_token', token);
```

### 토큰 사용

```typescript
const token = localStorage.getItem('auth_token');

const response = await fetch('/api/vms', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});
```

### 토큰 만료

토큰은 기본적으로 24시간 후 만료됩니다. 만료 시 401 Unauthorized 응답을 받습니다.

---

## 3. WebSocket 연결

### VM 상태 실시간 업데이트

```typescript
const ws = new WebSocket(`ws://localhost:18443/ws/vm-status?vm_id=1&token=${token}`);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('VM Status:', data);
};
```

### VNC 콘솔 연결

```typescript
const ws = new WebSocket(`ws://localhost:18443/ws/vnc?id=1&token=${token}`);

// noVNC와 통합하여 사용
```

---

## 4. Agent 서버

Agent는 시스템 메트릭스를 제공합니다.

### 메트릭스 엔드포인트

```http
GET /agent/metrics
```

**응답:**
```json
{
  "cpu": {
    "usage_percent": 45.2
  },
  "memory": {
    "total": 16777216000,
    "used": 8388608000,
    "usage_percent": 50.0
  },
  "disk": {
    "total": 107374182400,
    "used": 53687091200,
    "usage_percent": 50.0
  }
}
```

---

## 5. 데이터 모델

### VM

```typescript
interface VM {
  id: number;
  uuid: string;
  name: string;
  cpu: number;
  memory: number;
  status: "Running" | "Stopped" | "Paused" | "Error";
  os_type?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}
```

### User

```typescript
interface User {
  id: number;
  uuid: string;
  username: string;
  role: "admin" | "user";
  approved: boolean;
  created_at: string;
  updated_at: string;
}
```

### VMSnapshot

```typescript
interface VMSnapshot {
  id: number;
  vm_id: number;
  name: string;
  description?: string;
  libvirt_name: string;
  created_at: string;
  updated_at: string;
}
```

### QuotaUsage

```typescript
interface QuotaUsage {
  quota: {
    id: number;
    user_id: number;
    max_vms: number;
    max_cpu: number;
    max_memory: number;
  };
  usage: {
    vms: number;
    cpu: number;
    memory: number;
  };
}
```

---

## 6. CORS 및 보안

### CORS 설정

프로덕션 환경에서는 허용된 오리진만 설정됩니다:

```bash
ALLOWED_ORIGINS=https://www.darc.kr,https://darc.kr
```

### 보안 헤더

다음 보안 헤더가 자동으로 적용됩니다:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Content-Security-Policy`
- `Strict-Transport-Security` (HTTPS 사용 시)

---

## 7. 리버스 프록시

프로덕션 환경에서는 리버스 프록시(Nginx/Envoy)를 사용합니다.

### Nginx 설정 예시

```nginx
server {
    listen 443 ssl http2;
    server_name www.darc.kr;

    location /api {
        proxy_pass http://127.0.0.1:18443;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://127.0.0.1:18443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 8. 환경 변수

### 프론트엔드 환경 변수

```env
NEXT_PUBLIC_BACKEND_URL=https://www.darc.kr
NEXT_PUBLIC_API_URL=https://www.darc.kr/api
NEXT_PUBLIC_AGENT_URL=https://www.darc.kr/agent
```

---

## 9. 에러 처리

### 에러 응답 형식

```json
{
  "error": "Bad Request",
  "message": "Invalid request parameters"
}
```

### HTTP 상태 코드

- `200 OK` - 성공
- `201 Created` - 리소스 생성 성공
- `400 Bad Request` - 잘못된 요청
- `401 Unauthorized` - 인증 필요
- `403 Forbidden` - 권한 없음
- `404 Not Found` - 리소스 없음
- `500 Internal Server Error` - 서버 에러

---

## 10. 예제 코드

### React Hook 예시

```typescript
import { useState, useEffect } from 'react';

function useVMs() {
  const [vms, setVMs] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    fetch('/api/vms', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => res.json())
      .then(data => {
        setVMs(data);
        setLoading(false);
      });
  }, []);

  return { vms, loading };
}
```

---

## 관련 문서

- [API 레퍼런스](../../02-development/api/reference.md)
- [운영 가이드](../../04-operations/operations-guide.md)
- [문제 해결](../../04-operations/troubleshooting/common-issues.md)

---

**태그**: `#프론트엔드` `#개발자-가이드` `#API` `#WebSocket` `#과거-기록`

**카테고리**: 프론트엔드 > 가이드 > 개발자 가이드

**상태**: 과거 기록 (프론트엔드 제거됨)

**마지막 업데이트**: 2024-12-23
