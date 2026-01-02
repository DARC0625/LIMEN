# 번들 최적화

> **LIMEN 프론트엔드 번들 크기 최적화 가이드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [성능](./) > 번들 최적화

---

## 📋 목차

1. [번들 분석](#번들-분석)
2. [코드 스플리팅](#코드-스플리팅)
3. [동적 Import](#동적-import)
4. [Tree Shaking](#tree-shaking)
5. [최적화 결과](#최적화-결과)

---

## 번들 분석

### 분석 도구

```bash
# 번들 분석 실행
npm run build:analyze
```

`@next/bundle-analyzer`를 사용하여 번들 크기를 시각화합니다.

### 분석 결과 확인

빌드 후 브라우저에서 자동으로 열리는 리포트에서:
- 각 모듈의 크기 확인
- 중복 코드 확인
- 최적화 포인트 파악

---

## 코드 스플리팅

### 라우트별 스플리팅

Next.js App Router는 자동으로 라우트별 코드 스플리팅을 수행합니다.

### 동적 Import

조건부 렌더링 컴포넌트는 동적 import:

```typescript
// VNCViewer는 큰 라이브러리를 포함하므로 동적 로드
const VNCViewer = dynamicImport(
  () => import('../../components/VNCViewer'),
  {
    loading: () => <Loading />,
    ssr: false,
  }
);

// SnapshotManager는 조건부로만 렌더링
const SnapshotManager = dynamicImport(
  () => import('../components/SnapshotManager'),
  {
    loading: () => <Loading />,
    ssr: false,
  }
);
```

---

## 동적 Import

### 개발 도구 제외

React Query Devtools는 프로덕션에서 제외:

```typescript
// components/QueryProvider.tsx
const ReactQueryDevtools = process.env.NODE_ENV === 'development'
  ? dynamicImport(() => import('@tanstack/react-query-devtools'), { ssr: false })
  : null;
```

**절감 효과**: 약 100KB+ 절감

---

## Tree Shaking

### 자동 최적화

Next.js 16은 기본적으로 Tree Shaking을 지원합니다.

### 최적화 설정

```javascript
// next.config.js
const nextConfig = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'], // 에러와 경고는 유지
    } : false,
  },
};
```

---

## 최적화 결과

### 번들 크기 감소

- **Devtools 제외**: ~100KB 절감
- **Console.log 제거**: 약간의 크기 감소
- **코드 스플리팅**: 초기 번들 크기 감소

### 성능 개선

- **초기 로딩 시간**: 단축
- **필요한 코드만 로드**: 네트워크 사용량 감소
- **캐시 효율성**: 개선

---

## 관련 문서

- [성능 최적화](./optimization.md)
- [PWA 기능](./pwa.md)
- [코드 구조](../01-architecture/structure.md)

---

**태그**: `#번들` `#최적화` `#코드스플리팅` `#성능`

**카테고리**: 문서 > 프론트엔드 > 성능 > 번들 최적화

**마지막 업데이트**: 2024-12-14








