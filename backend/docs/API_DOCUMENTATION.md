# LIMEN API 문서

## 개요

LIMEN API는 가상 머신(VM) 관리 시스템을 위한 RESTful API입니다.

**Base URL**: `http://localhost:8080`

## 인증

현재 버전에서는 인증이 구현되지 않았습니다. 향후 JWT 기반 인증이 추가될 예정입니다.

## 엔드포인트

### Health Check

#### GET /api/health

서비스 상태를 확인합니다.

**Response 200 OK**
```json
{
  "status": "ok",
  "time": "2024-01-01T00:00:00Z",
  "db": "connected",
  "libvirt": "connected"
}
```

**Status Codes:**
- `db`: `connected` 또는 `disconnected`
- `libvirt`: `connected` 또는 `disconnected`

---

### VM 관리

#### GET /api/vms

모든 VM 목록을 조회합니다.

**Response 200 OK**
```json
[
  {
    "id": 1,
    "name": "my-vm-01",
    "cpu": 2,
    "memory": 2048,
    "status": "Running",
    "os_type": "ubuntu-desktop",
    "owner_id": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### POST /api/vms

새로운 VM을 생성합니다.

**Request Body**
```json
{
  "name": "my-vm-01",
  "cpu": 2,
  "memory": 2048,
  "os_type": "ubuntu-desktop"
}
```

**Validation Rules:**
- `name`: 3-64자, 영숫자, 하이픈, 언더스코어만 허용
- `cpu`: 1-32 사이의 정수
- `memory`: 512-65536MB, 256MB의 배수
- `os_type`: `ubuntu-desktop`, `ubuntu-server`, `kali`, `windows` 중 하나

**Response 201 Created**
```json
{
  "id": 1,
  "name": "my-vm-01",
  "cpu": 2,
  "memory": 2048,
  "status": "Running",
  "os_type": "ubuntu-desktop",
  "owner_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response 400 Bad Request**
```json
{
  "code": 400,
  "message": "VM name must be at least 3 characters",
  "error": "VM name must be at least 3 characters"
}
```

#### POST /api/vms/{id}/action

VM에 액션을 수행합니다.

**Path Parameters:**
- `id` (integer, required): VM ID

**Request Body**
```json
{
  "action": "start",
  "cpu": 4,
  "memory": 4096
}
```

**Actions:**
- `start`: VM 시작
- `stop`: VM 중지
- `delete`: VM 삭제
- `update`: VM 리소스 업데이트 (cpu, memory 필수)

**Response 200 OK**
```json
{
  "id": 1,
  "name": "my-vm-01",
  "cpu": 4,
  "memory": 4096,
  "status": "Running",
  "os_type": "ubuntu-desktop",
  "owner_id": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Response 400 Bad Request**
```json
{
  "code": 400,
  "message": "Invalid action. Valid actions: start, stop, delete, update",
  "error": "Invalid action. Valid actions: start, stop, delete, update"
}
```

**Response 404 Not Found**
```json
{
  "code": 404,
  "message": "VM not found"
}
```

---

### VNC 콘솔

#### GET /ws/vnc

VNC 콘솔에 대한 WebSocket 연결을 설정합니다.

**Query Parameters:**
- `id` (integer, required): VM ID

**Response 101 Switching Protocols**

WebSocket 연결이 설정되면, VNC 프로토콜 데이터가 전송됩니다.

**Response 400 Bad Request**
VM ID가 제공되지 않았거나 유효하지 않은 경우

**Response 404 Not Found**
VM을 찾을 수 없는 경우

---

## 에러 응답

모든 에러는 다음 형식을 따릅니다:

```json
{
  "code": 400,
  "message": "Error message",
  "error": "Internal error details (development only)"
}
```

**Status Codes:**
- `200`: 성공
- `201`: 생성 성공
- `400`: 잘못된 요청
- `404`: 리소스를 찾을 수 없음
- `500`: 내부 서버 오류

---

## CORS

CORS는 환경 변수 `ALLOWED_ORIGINS`로 설정됩니다.

**예시:**
```bash
ALLOWED_ORIGINS=http://localhost:3000,https://example.com
```

모든 Origin을 허용하려면:
```bash
ALLOWED_ORIGINS=*
```

---

## 요청 ID

모든 응답에는 `X-Request-ID` 헤더가 포함되어 요청을 추적할 수 있습니다.

---

## OpenAPI 스펙

전체 API 스펙은 `docs/swagger.yaml` 파일을 참조하세요.

Swagger UI를 사용하려면:
1. Swagger UI 서버 실행
2. `docs/swagger.yaml` 파일 로드

---

## 예제

### cURL 예제

**VM 목록 조회:**
```bash
curl http://localhost:8080/api/vms
```

**VM 생성:**
```bash
curl -X POST http://localhost:8080/api/vms \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-vm",
    "cpu": 2,
    "memory": 2048,
    "os_type": "ubuntu-desktop"
  }'
```

**VM 시작:**
```bash
curl -X POST http://localhost:8080/api/vms/1/action \
  -H "Content-Type: application/json" \
  -d '{"action": "start"}'
```

**VM 리소스 업데이트:**
```bash
curl -X POST http://localhost:8080/api/vms/1/action \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "cpu": 4,
    "memory": 4096
  }'
```

---

## 제한 사항

- VM은 중지된 상태에서만 리소스를 업데이트할 수 있습니다.
- 메모리는 256MB의 배수여야 합니다.
- CPU는 1-32 사이의 값이어야 합니다.
- VM 이름은 고유해야 합니다.


