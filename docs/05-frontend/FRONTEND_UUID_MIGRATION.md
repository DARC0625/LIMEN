# 프론트엔드 UUID 마이그레이션 가이드

## 개요

백엔드 API가 순차 번호(ID) 대신 UUID를 사용하도록 변경되었습니다. 프론트엔드에서 다음 변경이 필요합니다.

## 변경된 API 엔드포인트

### 이전 (숫자 ID)
```
GET    /api/vms/{id}
POST   /api/vms/{id}/action
GET    /api/vms/{id}/stats
DELETE /api/vms/{id}
GET    /api/vms/{id}/snapshots
POST   /api/vms/{id}/snapshots
```

### 변경 후 (UUID)
```
GET    /api/vms/{uuid}
POST   /api/vms/{uuid}/action
GET    /api/vms/{uuid}/stats
DELETE /api/vms/{uuid}
GET    /api/vms/{uuid}/snapshots
POST   /api/vms/{uuid}/snapshots
```

**UUID 형식**: `8-4-4-4-12` hexadecimal characters
예시: `75a8ccb9-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

## 프론트엔드에서 변경해야 할 사항

### 1. VM 목록 API 응답 처리

VM 목록을 가져올 때 `id` 대신 `uuid` 필드를 사용:

```typescript
// 이전
const vmId = vm.id; // 숫자

// 변경 후
const vmUuid = vm.uuid; // UUID 문자열
```

### 2. API 호출 시 UUID 사용

모든 VM 관련 API 호출에서 UUID 사용:

```typescript
// 이전
fetch(`/api/vms/${vm.id}/action`, { ... })

// 변경 후
fetch(`/api/vms/${vm.uuid}/action`, { ... })
```

### 3. VNC WebSocket 연결

VNC 콘솔 연결 시 UUID 사용:

```typescript
// 이전
const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.id}&token=${token}`);

// 변경 후
const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.uuid}&token=${token}`);
```

### 4. VM 삭제

VM 삭제 시 UUID 사용:

```typescript
// 이전
await fetch(`/api/vms/${vm.id}`, { method: 'DELETE' });

// 변경 후
await fetch(`/api/vms/${vm.uuid}`, { method: 'DELETE' });
```

### 5. VM 액션 (start, stop, delete, update)

VM 액션 호출 시 UUID 사용:

```typescript
// 이전
await fetch(`/api/vms/${vm.id}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'start' })
});

// 변경 후
await fetch(`/api/vms/${vm.uuid}/action`, {
  method: 'POST',
  body: JSON.stringify({ action: 'start' })
});
```

### 6. VM 통계

VM 통계 조회 시 UUID 사용:

```typescript
// 이전
const stats = await fetch(`/api/vms/${vm.id}/stats`);

// 변경 후
const stats = await fetch(`/api/vms/${vm.uuid}/stats`);
```

### 7. 스냅샷

스냅샷 관련 API 호출 시 UUID 사용:

```typescript
// 이전
await fetch(`/api/vms/${vm.id}/snapshots`);

// 변경 후
await fetch(`/api/vms/${vm.uuid}/snapshots`);
```

## UUID 유효성 검증

UUID 형식 검증을 추가하는 것을 권장합니다:

```typescript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}
```

## 마이그레이션 체크리스트

- [ ] VM 목록에서 `id` 대신 `uuid` 사용
- [ ] 모든 VM API 호출에서 UUID 사용
- [ ] VNC WebSocket 연결 시 UUID 사용
- [ ] VM 삭제 시 UUID 사용
- [ ] VM 액션 호출 시 UUID 사용
- [ ] VM 통계 조회 시 UUID 사용
- [ ] 스냅샷 API 호출 시 UUID 사용
- [ ] UUID 형식 검증 추가 (선택 사항)

## 주의사항

1. **하위 호환성 없음**: 숫자 ID는 더 이상 지원되지 않습니다.
2. **UUID는 항상 문자열**: 숫자로 변환하지 마세요.
3. **URL 인코딩**: UUID는 URL-safe하므로 인코딩이 필요 없습니다.

## 예시 코드

### React 컴포넌트 예시

```typescript
interface VM {
  id: number;        // 내부 ID (표시용)
  uuid: string;      // API 호출용 UUID
  name: string;
  status: string;
  // ...
}

function VMCard({ vm }: { vm: VM }) {
  const handleStart = async () => {
    await fetch(`/api/vms/${vm.uuid}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    });
  };

  const handleDelete = async () => {
    await fetch(`/api/vms/${vm.uuid}`, {
      method: 'DELETE'
    });
  };

  const openVNC = () => {
    const token = getAuthToken();
    const ws = new WebSocket(`wss://limen.kr/ws/vnc?id=${vm.uuid}&token=${token}`);
    // ...
  };

  return (
    <div>
      <h3>{vm.name}</h3>
      <p>UUID: {vm.uuid}</p>
      <button onClick={handleStart}>Start</button>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={openVNC}>Open Console</button>
    </div>
  );
}
```

## 관련 문서

- [백엔드 API 문서](../../docs/API_DOCUMENTATION.md)
- [시스템 아키텍처](../../docs/01-architecture/system-design.md)






