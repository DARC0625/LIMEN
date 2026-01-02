# 캐싱 전략

> **LIMEN 프론트엔드 캐싱 전략 및 최적화**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > 캐싱

---

## 📋 목차

1. [React Query 캐싱](#react-query-캐싱)
2. [Service Worker 캐싱](#service-worker-캐싱)
3. [캐싱 전략](#캐싱-전략)
4. [WebSocket 통합](#websocket-통합)

---

## React Query 캐싱

### 전역 설정

```typescript
// lib/queryClient.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 10 * 60 * 1000, // 10분
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});
```

### VM 데이터 캐싱

```typescript
// hooks/useVMs.ts
export function useVMs() {
  return useQuery({
    queryKey: ['vms'],
    queryFn: vmAPI.list,
    staleTime: 5 * 60 * 1000, // 5분
    // refetchInterval 제거 (WebSocket으로 실시간 업데이트)
  });
}
```

---

## Service Worker 캐싱

### 캐시 전략

- **네트워크 우선**: API 요청
- **캐시 우선**: 정적 리소스

### 캐시된 리소스

- 정적 페이지 (`/`, `/login`, `/register`)
- 이미지 및 폰트
- CSS 및 JavaScript

---

## 캐싱 전략

### VM 데이터

- **캐시 시간**: 5분
- **업데이트**: WebSocket으로 실시간
- **재요청**: 네트워크 재연결 시

### 할당량 데이터

- **캐시 시간**: 5분
- **업데이트**: VM 변경 시 자동 무효화

### Agent 메트릭

- **캐시 시간**: 5초 (짧음)
- **재요청**: 5초마다 자동

---

## WebSocket 통합

WebSocket으로 실시간 업데이트를 받아 불필요한 API 호출을 줄입니다:

```typescript
// hooks/useVMWebSocket.ts
useVMWebSocket(
  (vm) => {
    // 캐시에 직접 업데이트
    queryClient.setQueryData(['vms'], (prev) => 
      prev.map(v => v.id === vm.id ? vm : v)
    );
  },
  (vms) => {
    // 전체 목록 업데이트
    queryClient.setQueryData(['vms'], vms);
  },
  true
);
```

---

## 관련 문서

- [성능 최적화](./optimization.md)
- [PWA 기능](./pwa.md)
- [React Query 설정](../05-lib/queryClient.md)

---

**태그**: `#캐싱` `#ReactQuery` `#ServiceWorker` `#성능`

**카테고리**: 문서 > 프론트엔드 > 성능 > 캐싱

**마지막 업데이트**: 2024-12-14








