# API 통합 가이드

> **LIMEN 백엔드 API 통합 완전 가이드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [개발 가이드](./) > API 통합

---

## 📋 목차

1. [API 엔드포인트 목록](#api-엔드포인트-목록)
2. [인증/인가 방식](#인증인가-방식)
3. [WebSocket 연결](#websocket-연결)
4. [데이터 모델](#데이터-모델)
5. [에러 처리](#에러-처리)
6. [예제 코드](#예제-코드)

---

## API 엔드포인트 목록

### Base URL

```
http://10.0.0.100:18443/api
```

환경 변수로 설정:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
```

---

### 공개 엔드포인트 (인증 불필요)

#### 헬스 체크
```http
GET /api/health
```

**응답:**
```json
{
  "status": "ok",
  "time": "2024-12-14T19:30:00+09:00",
  "db": "connected",
  "libvirt": "connected"
}
```

#### 로그인
```http
POST /api/auth/login
Content-Type: application/json
```

**요청:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**응답:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-12-15T19:30:00+09:00",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

#### 회원가입
```http
POST /api/auth/register
Content-Type: application/json
```

**요청:**
```json
{
  "username": "newuser",
  "password": "password123"
}
```

---

### 보호된 엔드포인트 (인증 필요)

모든 보호된 엔드포인트는 다음 헤더가 필요합니다:
```http
Authorization: Bearer <JWT_TOKEN>
```

#### VM 목록 조회
```http
GET /api/vms
Authorization: Bearer <token>
```

#### VM 생성
```http
POST /api/vms
Authorization: Bearer <token>
Content-Type: application/json
```

**요청:**
```json
{
  "name": "New VM",
  "cpu": 2,
  "memory": 2048,
  "os_type": "ubuntu-desktop"
}
```

#### VM 액션
```http
POST /api/vms/{id}/action
Authorization: Bearer <token>
Content-Type: application/json
```

**요청:**
```json
{
  "action": "start",  // "start", "stop", "restart", "delete", "update"
  "cpu": 4,           // update 시에만 필요
  "memory": 4096      // update 시에만 필요
}
```

---

## 인증/인가 방식

### JWT 토큰 기반 인증

LIMEN은 **JWT (JSON Web Token)** 기반 인증을 사용합니다.

#### 토큰 저장
- **위치**: `localStorage`
- **키**: `auth_token`

```typescript
// lib/api.ts
export function setToken(token: string) {
  localStorage.setItem('auth_token', token);
}

export function getToken(): string | null {
  return localStorage.getItem('auth_token');
}

export function removeToken() {
  localStorage.removeItem('auth_token');
}
```

#### 토큰 전송
모든 보호된 API 요청에 자동으로 포함:

```typescript
// lib/api.ts
const token = getToken();
const response = await fetch(`${API_URL}/vms`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

#### 역할 기반 접근 제어 (RBAC)

```typescript
// lib/api.ts
export function isAdmin(): boolean {
  const token = getToken();
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role === 'admin';
  } catch {
    return false;
  }
}
```

---

## WebSocket 연결

### VM 상태 업데이트 WebSocket

#### 엔드포인트
```
ws://10.0.0.100:18443/ws/vm-status?token=<JWT_TOKEN>
또는
wss://10.0.0.100:18443/ws/vm-status?token=<JWT_TOKEN> (HTTPS 환경)
```

#### 메시지 형식

**수신 메시지:**

1. **VM 업데이트:**
```json
{
  "type": "vm_update",
  "vm": {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My VM",
    "cpu": 2,
    "memory": 2048,
    "status": "Running",
    "os_type": "ubuntu-desktop",
    "owner_id": 1,
    "created_at": "2024-12-14T10:00:00+09:00",
    "updated_at": "2024-12-14T19:30:00+09:00"
  }
}
```

2. **VM 목록:**
```json
{
  "type": "vm_list",
  "vms": [...]
}
```

#### 사용 예제

```typescript
// hooks/useVMWebSocket.ts
import { useVMWebSocket } from '../hooks/useVMWebSocket';

const handleVMUpdate = (vm: VM) => {
  queryClient.setQueryData(['vms'], (prev) => 
    prev.map(v => v.id === vm.id ? vm : v)
  );
};

const handleVMList = (vms: VM[]) => {
  queryClient.setQueryData(['vms'], vms);
};

useVMWebSocket(handleVMUpdate, handleVMList, true);
```

---

## 데이터 모델

### VM 모델

```typescript
interface VM {
  id: number;
  uuid: string;
  name: string;
  cpu: number;
  memory: number;
  status: VMStatus;
  os_type?: string;
  owner_id: number;
  created_at: string;
  updated_at: string;
}

type VMStatus = "Running" | "Stopped" | "Paused" | "Error";
```

### User 모델

```typescript
interface User {
  id: number;
  uuid: string;
  username: string;
  role: UserRole;
  approved: boolean;
  created_at: string;
  updated_at: string;
}

type UserRole = "admin" | "user";
```

### QuotaUsage 모델

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

## 에러 처리

### 에러 응답 형식

```json
{
  "error": "Error message",
  "message": "Detailed error message"
}
```

### HTTP 상태 코드

- `200 OK`: 성공
- `400 Bad Request`: 잘못된 요청
- `401 Unauthorized`: 인증 필요
- `403 Forbidden`: 권한 없음
- `404 Not Found`: 리소스 없음
- `409 Conflict`: 리소스 충돌
- `500 Internal Server Error`: 서버 오류

### 에러 처리 예제

```typescript
try {
  const vm = await vmAPI.create({ name: 'New VM', cpu: 2, memory: 2048 });
} catch (error) {
  if (error.message.includes('Authentication required')) {
    // 401: 로그아웃 처리
    removeToken();
    router.push('/login');
  } else if (error.message.includes('already exists')) {
    // 409: 이름 중복
    toast.error('VM 이름이 이미 존재합니다');
  } else {
    // 기타 오류
    toast.error(error.message || '오류가 발생했습니다');
  }
}
```

---

## 예제 코드

### API 클라이언트 사용

```typescript
import { vmAPI, authAPI, snapshotAPI, quotaAPI } from '../lib/api';

// 로그인
const response = await authAPI.login({
  username: 'admin',
  password: 'password'
});
setToken(response.token);

// VM 목록 조회
const vms = await vmAPI.list();

// VM 생성
const newVM = await vmAPI.create({
  name: 'My VM',
  cpu: 2,
  memory: 2048,
  os_type: 'ubuntu-desktop'
});

// VM 시작
await vmAPI.action(newVM.id, 'start');

// 할당량 조회
const quota = await quotaAPI.get();
```

### React Query Hook 사용

```typescript
import { useVMs, useCreateVM, useVMAction } from '../hooks/useVMs';

function Dashboard() {
  const { data: vms, isLoading } = useVMs();
  const createVMMutation = useCreateVM();
  const vmActionMutation = useVMAction();

  const handleCreate = () => {
    createVMMutation.mutate({
      name: 'New VM',
      cpu: 2,
      memory: 2048,
      os_type: 'ubuntu-desktop'
    });
  };

  const handleAction = (id: number, action: 'start' | 'stop') => {
    vmActionMutation.mutate({ id, action });
  };

  return (
    <div>
      {vms?.map(vm => (
        <VMCard key={vm.id} vm={vm} onAction={handleAction} />
      ))}
    </div>
  );
}
```

---

## 관련 문서

- [프론트엔드 개요](../00-overview.md)
- [코드 구조](../01-architecture/structure.md)
- [컴포넌트](../03-components/)
- [Hooks](../04-hooks/)
- [라이브러리](../05-lib/api.md)

---

**태그**: `#API` `#통합` `#인증` `#WebSocket` `#개발가이드`

**카테고리**: 문서 > 프론트엔드 > 개발 가이드 > API 통합

**마지막 업데이트**: 2024-12-14








