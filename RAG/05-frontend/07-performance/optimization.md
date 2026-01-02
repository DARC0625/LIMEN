# 성능 최적화

> **LIMEN 프론트엔드 성능 최적화 전략 및 구현**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > 최적화

---

## 📋 목차

1. [최적화 전략](#최적화-전략)
2. [렌더링 최적화](#렌더링-최적화)
3. [데이터 페칭 최적화](#데이터-페칭-최적화)
4. [번들 최적화](#번들-최적화)
5. [이미지 최적화](#이미지-최적화)
6. [캐싱 전략](#캐싱-전략)

---

## 최적화 전략

### 구현된 최적화

1. ✅ **동적 렌더링**: `export const dynamic = 'force-dynamic'`
2. ✅ **코드 스플리팅**: 동적 import 활용
3. ✅ **Optimistic Updates**: 즉시 UI 업데이트
4. ✅ **캐싱 전략**: React Query 캐싱 최적화
5. ✅ **병렬 데이터 페칭**: React Query 기본 동작
6. ✅ **로딩 스켈레톤**: Suspense 기반
7. ✅ **에러 바운더리**: 크래시 방지
8. ✅ **Web Vitals 모니터링**: 성능 측정

---

## 렌더링 최적화

### 동적 렌더링

모든 페이지는 동적 렌더링을 사용합니다:

```typescript
// app/page.tsx
export const dynamic = 'force-dynamic';
```

### Streaming SSR

Suspense를 활용한 점진적 렌더링:

```typescript
<Suspense fallback={<Skeleton />}>
  <QuotaDisplay />
</Suspense>

<Suspense fallback={<VMCardSkeleton />}>
  <VMList vms={vms} />
</Suspense>
```

### 코드 스플리팅

조건부 렌더링 컴포넌트는 동적 import:

```typescript
const SnapshotManager = dynamicImport(
  () => import('../components/SnapshotManager'),
  {
    loading: () => <Loading />,
    ssr: false,
  }
);
```

---

## 데이터 페칭 최적화

### React Query 캐싱

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

### Optimistic Updates

```typescript
// hooks/useVMs.ts
const useVMAction = () => {
  return useMutation({
    mutationFn: ({ id, action }) => vmAPI.action(id, action),
    onMutate: async ({ id, action }) => {
      // 즉시 UI 업데이트
      await queryClient.cancelQueries({ queryKey: ['vms'] });
      const previousVMs = queryClient.getQueryData(['vms']);
      queryClient.setQueryData(['vms'], (old) => 
        old.map(vm => vm.id === id ? { ...vm, status: 'Processing' } : vm)
      );
      return { previousVMs };
    },
    onError: (err, variables, context) => {
      // 롤백
      queryClient.setQueryData(['vms'], context.previousVMs);
    },
  });
};
```

### WebSocket 통합

WebSocket으로 실시간 업데이트를 받아 불필요한 API 호출을 줄입니다:

```typescript
// hooks/useVMWebSocket.ts
useVMWebSocket(
  (vm) => {
    // VM 업데이트를 캐시에 직접 반영
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

## 번들 최적화

### 동적 Import

개발 도구는 프로덕션에서 제외:

```typescript
// components/QueryProvider.tsx
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamicImport(() => import('@tanstack/react-query-devtools'), { ssr: false })
  : null;
```

### Tree Shaking

Next.js 16은 기본적으로 Tree Shaking을 지원합니다.

### 번들 분석

```bash
npm run build:analyze
```

---

## 이미지 최적화

### Next.js Image 컴포넌트

```typescript
import Image from 'next/image';

<Image
  src="/icon-192.png"
  width={192}
  height={192}
  alt="LIMEN Icon"
  priority
/>
```

### 이미지 포맷

Next.js는 자동으로 WebP/AVIF로 변환합니다.

---

## 캐싱 전략

### React Query 캐싱

- **staleTime**: 5분 (데이터가 신선하다고 간주되는 시간)
- **gcTime**: 10분 (캐시에서 제거되기 전 시간)
- **refetchOnWindowFocus**: false (창 포커스 시 재요청 비활성화)
- **refetchOnReconnect**: true (네트워크 재연결 시 재요청)

### Service Worker 캐싱

PWA Service Worker가 정적 리소스를 캐싱합니다.

---

## 관련 문서

- [번들 최적화](./bundle.md)
- [PWA 기능](./pwa.md)
- [캐싱 전략](./caching.md)
- [Web Vitals 모니터링](../01-architecture/monitoring.md)

---

**태그**: `#성능` `#최적화` `#렌더링` `#캐싱`

**카테고리**: 문서 > 프론트엔드 > 성능 > 최적화

**마지막 업데이트**: 2024-12-14








