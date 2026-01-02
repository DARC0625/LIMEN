# API 레퍼런스

> [← 홈](../00-home.md) | [개발](../getting-started.md) | [API](./reference.md)

## 기본 정보

- **Base URL**: `http://localhost:18443/api`
- **인증**: JWT Bearer Token
- **Content-Type**: `application/json`

---

## 인증

모든 보호된 엔드포인트는 다음 헤더가 필요합니다:

```
Authorization: Bearer <JWT_TOKEN>
```

토큰은 로그인 API를 통해 획득합니다.

---

## 공개 엔드포인트

### 헬스 체크

```http
GET /api/health
```

**응답**:
```json
{
  "status": "ok",
  "db": "connected"
}
```

### 로그인

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password"
}
```

**응답**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

### 회원가입

```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "newuser",
  "password": "password",
  "email": "user@example.com"
}
```

**응답**:
```json
{
  "message": "User registered successfully. Waiting for approval."
}
```

---

## VM 관리

### VM 목록 조회

```http
GET /api/vms
Authorization: Bearer <token>
```

**응답**:
```json
[
  {
    "id": 1,
    "uuid": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My VM",
    "cpu": 2,
    "memory": 2048,
    "status": "Running",
    "os_type": "ubuntu-desktop",
    "owner_id": 1,
    "created_at": "2024-12-23T10:00:00Z",
    "updated_at": "2024-12-23T10:00:00Z"
  }
]
```

### VM 생성

```http
POST /api/vms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "My VM",
  "cpu": 2,
  "memory": 2048,
  "os_type": "ubuntu-desktop"
}
```

**응답**: 생성된 VM 객체

### VM 액션

```http
POST /api/vms/{id}/action
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "start"  // start, stop, restart, delete, resize
}
```

**리소스 조정**:
```json
{
  "action": "resize",
  "cpu": 4,
  "memory": 4096
}
```

### VM 통계 조회

```http
GET /api/vms/{id}/stats
Authorization: Bearer <token>
```

---

## 스냅샷 관리

### 스냅샷 목록

```http
GET /api/vms/{id}/snapshots
Authorization: Bearer <token>
```

### 스냅샷 생성

```http
POST /api/vms/{id}/snapshots
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Snapshot 1",
  "description": "Before update"
}
```

### 스냅샷 복원

```http
POST /api/snapshots/{snapshot_id}/restore
Authorization: Bearer <token>
```

### 스냅샷 삭제

```http
DELETE /api/snapshots/{snapshot_id}
Authorization: Bearer <token>
```

---

## 할당량 관리

### 할당량 조회

```http
GET /api/quota
Authorization: Bearer <token>
```

**응답**:
```json
{
  "quota": {
    "max_vms": 10,
    "max_cpu": 20,
    "max_memory": 40960
  },
  "usage": {
    "vms": 3,
    "cpu": 6,
    "memory": 12288
  }
}
```

### 할당량 업데이트 (Admin만)

```http
PUT /api/quota
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "max_vms": 20,
  "max_cpu": 40,
  "max_memory": 81920
}
```

---

## 사용자 관리 (Admin만)

### 사용자 목록

```http
GET /api/admin/users
Authorization: Bearer <admin_token>
```

### 사용자 생성

```http
POST /api/admin/users
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "newuser",
  "password": "password",
  "role": "user"
}
```

### 사용자 조회

```http
GET /api/admin/users/{id}
Authorization: Bearer <admin_token>
```

### 사용자 업데이트

```http
PUT /api/admin/users/{id}
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "username": "updateduser"
}
```

### 사용자 삭제

```http
DELETE /api/admin/users/{id}
Authorization: Bearer <admin_token>
```

**응답**:
```json
{
  "deleted": true,
  "user_id": 1,
  "username": "user",
  "timestamp": "2024-12-23T10:00:00Z"
}
```

### 역할 변경

```http
PUT /api/admin/users/{id}/role
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "role": "admin"
}
```

### 사용자 승인

```http
PUT /api/admin/users/{id}/approve
Authorization: Bearer <admin_token>
```

---

## WebSocket 엔드포인트

### VM 상태 실시간 업데이트

```javascript
const ws = new WebSocket('ws://localhost:18443/ws/vm-status?vm_id=1&token=<token>');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('VM Status:', data);
};
```

### VNC 콘솔 연결

```javascript
const ws = new WebSocket('ws://localhost:18443/ws/vnc?id=1&token=<token>');
// noVNC와 통합하여 사용
```

---

## 에러 응답

### 400 Bad Request

```json
{
  "error": "Invalid request",
  "message": "CPU must be greater than 0"
}
```

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Admin access required"
}
```

### 404 Not Found

```json
{
  "error": "Not Found",
  "message": "VM not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "message": "An unexpected error occurred"
}
```

---

## TypeScript 인터페이스

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

interface User {
  id: number;
  uuid: string;
  username: string;
  role: "admin" | "user";
  approved: boolean;
  created_at: string;
  updated_at: string;
}

interface VMSnapshot {
  id: number;
  vm_id: number;
  name: string;
  description?: string;
  libvirt_name: string;
  created_at: string;
  updated_at: string;
}

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

## 관련 문서

- [개발 시작하기](../getting-started.md)
- [테스트 가이드](./testing/)
- [Swagger UI](http://localhost:18443/swagger)

---

**태그**: `#개발` `#API` `#레퍼런스` `#REST` `#WebSocket`

**카테고리**: 개발 > API

**마지막 업데이트**: 2024-12-23
