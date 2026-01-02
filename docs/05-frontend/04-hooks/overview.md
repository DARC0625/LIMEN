# Hooks 개요

> **LIMEN 프론트엔드 Custom React Hooks 가이드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [Hooks](./) > 개요

---

## 📋 목차

1. [Hooks 구조](#hooks-구조)
2. [주요 Hooks](#주요-hooks)
3. [사용 예제](#사용-예제)

---

## Hooks 구조

### 디렉토리 구조

```
hooks/
├── useVMs.ts           # VM 관리 Hook
├── useQuota.ts         # 할당량 Hook
├── useVMWebSocket.ts   # WebSocket Hook
└── useAgentMetrics.ts  # Agent 메트릭 Hook
```

---

## 주요 Hooks

### useVMs

VM 목록 조회, 생성, 액션을 제공합니다.

```typescript
const { data: vms, isLoading } = useVMs();
const createVMMutation = useCreateVM();
const vmActionMutation = useVMAction();
```

### useQuota

할당량 정보를 조회합니다.

```typescript
const { data: quota, isLoading } = useQuota();
```

### useVMWebSocket

VM 상태 실시간 업데이트를 제공합니다.

```typescript
useVMWebSocket(
  (vm) => handleVMUpdate(vm),
  (vms) => handleVMList(vms),
  true
);
```

### useAgentMetrics

Agent 서버 메트릭을 조회합니다.

```typescript
const { data: metrics, isError } = useAgentMetrics();
```

---

## 사용 예제

### VM 관리

```typescript
import { useVMs, useCreateVM, useVMAction } from '../hooks/useVMs';

function Dashboard() {
  const { data: vms } = useVMs();
  const createVM = useCreateVM();
  const vmAction = useVMAction();

  const handleCreate = () => {
    createVM.mutate({
      name: 'New VM',
      cpu: 2,
      memory: 2048,
      os_type: 'ubuntu-desktop'
    });
  };

  return (
    <div>
      {vms?.map(vm => (
        <VMCard key={vm.id} vm={vm} />
      ))}
    </div>
  );
}
```

---

## 관련 문서

- [코드 구조](../01-architecture/structure.md)
- [API 통합](../02-development/api-integration.md)

---

**태그**: `#Hooks` `#React` `#상태관리`

**카테고리**: 문서 > 프론트엔드 > Hooks > 개요

**마지막 업데이트**: 2024-12-14








