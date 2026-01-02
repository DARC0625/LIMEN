# 컴포넌트 개요

> **LIMEN 프론트엔드 React 컴포넌트 가이드**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [컴포넌트](./) > 개요

---

## 📋 목차

1. [컴포넌트 구조](#컴포넌트-구조)
2. [주요 컴포넌트](#주요-컴포넌트)
3. [컴포넌트 사용법](#컴포넌트-사용법)

---

## 컴포넌트 구조

### 디렉토리 구조

```
components/
├── AuthGuard.tsx          # 인증 가드
├── LoginForm.tsx          # 로그인 폼
├── RegisterForm.tsx       # 회원가입 폼
├── VNCViewer.tsx          # VNC 콘솔
├── VMList.tsx             # VM 목록 (카루셀)
├── SnapshotManager.tsx    # 스냅샷 관리
├── QuotaDisplay.tsx       # 할당량 표시
├── Toast.tsx              # 토스트 메시지
├── ToastContainer.tsx     # 토스트 컨테이너
├── Loading.tsx            # 로딩 스피너
├── Skeleton.tsx           # 로딩 스켈레톤
├── ErrorBoundary.tsx      # 에러 바운더리
├── ThemeProvider.tsx       # 테마 제공자
├── ThemeToggle.tsx        # 테마 토글
├── QueryProvider.tsx      # React Query 제공자
├── PWARegister.tsx        # PWA 등록
└── WebVitalsClient.tsx    # Web Vitals 클라이언트
```

---

## 주요 컴포넌트

### 인증 관련

- **AuthGuard**: 라우트 보호
- **LoginForm**: 로그인 UI
- **RegisterForm**: 회원가입 UI

### VM 관련

- **VMList**: VM 카루셀 컴포넌트
- **VNCViewer**: VNC 콘솔 뷰어
- **SnapshotManager**: 스냅샷 관리 UI

### UI 컴포넌트

- **QuotaDisplay**: 할당량 표시
- **Toast**: 알림 시스템
- **Loading**: 로딩 스피너
- **Skeleton**: 로딩 스켈레톤

### 시스템 컴포넌트

- **ThemeProvider**: 다크 모드 관리
- **ErrorBoundary**: 에러 처리
- **QueryProvider**: React Query 설정

---

## 컴포넌트 사용법

### 기본 사용

```typescript
import VMList from '../components/VMList';

<VMList 
  vms={vms}
  onAction={handleAction}
  onEdit={setEditingVM}
/>
```

---

## 관련 문서

- [코드 구조](../01-architecture/structure.md)
- [개발 가이드](../02-development/)

---

**태그**: `#컴포넌트` `#React` `#UI`

**카테고리**: 문서 > 프론트엔드 > 컴포넌트 > 개요

**마지막 업데이트**: 2024-12-14








