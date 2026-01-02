# 프론트엔드 코드 구조

> **LIMEN 프론트엔드 코드베이스 구조 및 조직**

**브레드크럼**: [홈](../../00-home.md) > [프론트엔드](../README.md) > [아키텍처](./) > 코드 구조

---

## 📁 디렉토리 구조

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 메인 대시보드 페이지
│   ├── globals.css         # 전역 스타일
│   ├── login/
│   │   └── page.tsx        # 로그인 페이지
│   ├── register/
│   │   └── page.tsx        # 회원가입 페이지
│   ├── admin/
│   │   └── users/
│   │       └── page.tsx    # 관리자 사용자 관리 페이지
│   ├── vnc/
│   │   └── [id]/
│   │       └── page.tsx    # VNC 콘솔 페이지 (동적 라우팅)
│   └── offline/
│       └── page.tsx        # 오프라인 페이지
│
├── components/             # React 컴포넌트
│   ├── AuthGuard.tsx       # 인증 가드 (라우트 보호)
│   ├── LoginForm.tsx       # 로그인 폼
│   ├── RegisterForm.tsx    # 회원가입 폼
│   ├── VNCViewer.tsx       # VNC 콘솔 뷰어
│   ├── VMList.tsx          # VM 목록 컴포넌트
│   ├── SnapshotManager.tsx # 스냅샷 관리 컴포넌트
│   ├── QuotaDisplay.tsx    # 할당량 표시 컴포넌트
│   ├── Toast.tsx           # 토스트 메시지 컴포넌트
│   ├── ToastContainer.tsx  # 토스트 컨테이너
│   ├── Loading.tsx         # 로딩 스피너
│   ├── Skeleton.tsx        # 로딩 스켈레톤
│   ├── ErrorBoundary.tsx   # 에러 바운더리
│   ├── ThemeProvider.tsx   # 테마 제공자
│   ├── ThemeToggle.tsx     # 테마 토글
│   ├── QueryProvider.tsx   # React Query 제공자
│   ├── PWARegister.tsx     # PWA 등록
│   └── WebVitalsClient.tsx # Web Vitals 클라이언트
│
├── hooks/                  # Custom React Hooks
│   ├── useVMs.ts           # VM 관리 Hook
│   ├── useQuota.ts         # 할당량 Hook
│   ├── useVMWebSocket.ts   # VM 상태 WebSocket 훅
│   └── useAgentMetrics.ts  # Agent 메트릭 Hook
│
├── lib/                    # 유틸리티 및 API 클라이언트
│   ├── api.ts              # API 클라이언트 (모든 API 함수)
│   ├── queryClient.ts      # React Query 클라이언트 설정
│   ├── errorTracking.ts    # 에러 추적 유틸리티
│   ├── analytics.ts        # 분석 유틸리티
│   └── webVitals.ts        # Web Vitals 모니터링
│
├── public/                 # 정적 파일
│   ├── manifest.json       # PWA 매니페스트
│   ├── sw.js               # Service Worker
│   ├── icon-192.svg        # PWA 아이콘
│   └── icon-512.svg        # PWA 아이콘
│
├── package.json
├── next.config.js          # Next.js 설정
├── tsconfig.json           # TypeScript 설정
├── tailwind.config.js      # Tailwind CSS 설정
└── postcss.config.js       # PostCSS 설정
```

---

## 📄 주요 파일 설명

### App Router (`app/`)

#### `layout.tsx` - 루트 레이아웃
- 모든 페이지의 공통 레이아웃
- Provider 설정 (Theme, Query, Toast, ErrorBoundary)
- PWA 매니페스트 및 메타 태그
- 접근성 지원 (aria-live region)

#### `page.tsx` - 메인 대시보드
- VM 목록 표시 (카루셀 형식)
- VM 생성 폼
- 실시간 상태 업데이트 (WebSocket)
- 할당량 표시
- 시스템 상태 모니터링

#### `login/page.tsx` - 로그인 페이지
- LoginForm 컴포넌트 사용
- 로그인 후 대시보드로 리다이렉트

#### `register/page.tsx` - 회원가입 페이지
- RegisterForm 컴포넌트 사용
- 회원가입 후 로그인 페이지로 리다이렉트

#### `admin/users/page.tsx` - 관리자 사용자 관리
- 사용자 목록 조회
- 사용자 생성/수정/삭제
- 사용자 승인
- 역할 변경

#### `vnc/[id]/page.tsx` - VNC 콘솔
- 동적 라우팅 (`[id]`는 VM ID)
- VNCViewer 컴포넌트 사용
- 동적 import로 코드 스플리팅

#### `offline/page.tsx` - 오프라인 페이지
- 네트워크 오류 시 표시
- Service Worker와 연동

---

### Components (`components/`)

#### 인증 관련
- **AuthGuard.tsx**: 인증 상태 확인, 미인증 시 리다이렉트
- **LoginForm.tsx**: 로그인 폼 UI 및 로직
- **RegisterForm.tsx**: 회원가입 폼 UI 및 로직

#### VM 관련
- **VMList.tsx**: VM 카루셀 컴포넌트
- **VNCViewer.tsx**: noVNC 기반 VNC 콘솔
- **SnapshotManager.tsx**: 스냅샷 관리 UI

#### UI 컴포넌트
- **QuotaDisplay.tsx**: 할당량 표시
- **Toast.tsx** & **ToastContainer.tsx**: 토스트 알림 시스템
- **Loading.tsx**: 로딩 스피너
- **Skeleton.tsx**: 로딩 스켈레톤
- **ErrorBoundary.tsx**: React 에러 바운더리

#### 시스템 컴포넌트
- **ThemeProvider.tsx**: 다크 모드 테마 관리
- **ThemeToggle.tsx**: 테마 전환 버튼
- **QueryProvider.tsx**: React Query 설정
- **PWARegister.tsx**: PWA 설치 프롬프트
- **WebVitalsClient.tsx**: Web Vitals 모니터링

---

### Hooks (`hooks/`)

#### `useVMs.ts`
- VM 목록 조회 (`useVMs`)
- VM 생성 (`useCreateVM`)
- VM 액션 (`useVMAction`: start, stop, delete, update)
- Optimistic Updates 지원
- React Query 기반 캐싱

#### `useQuota.ts`
- 할당량 조회
- 캐싱 전략 최적화

#### `useVMWebSocket.ts`
- VM 상태 실시간 업데이트 WebSocket 연결
- 자동 재연결 기능
- `vm_update`, `vm_list` 메시지 처리

#### `useAgentMetrics.ts`
- Agent 서버 메트릭 조회
- CPU 및 메모리 사용량

---

### Lib (`lib/`)

#### `api.ts`
- 모든 API 호출 함수
- JWT 토큰 관리
- 에러 처리
- TypeScript 인터페이스 정의

**주요 API 그룹:**
- `authAPI`: 로그인, 회원가입
- `vmAPI`: VM CRUD 및 액션
- `snapshotAPI`: 스냅샷 관리
- `quotaAPI`: 할당량 조회/업데이트
- `adminAPI`: 관리자 기능
- `agentAPI`: Agent 메트릭

#### `queryClient.ts`
- React Query 클라이언트 설정
- 전역 캐싱 전략
- 기본 옵션 설정

#### `errorTracking.ts`
- 중앙화된 에러 추적
- Sentry 연동 준비

#### `analytics.ts`
- 페이지 뷰 추적
- 이벤트 추적
- Google Analytics / Plausible 연동 준비

#### `webVitals.ts`
- Web Vitals 모니터링
- Core Web Vitals 측정
- Performance Observer 활용

---

## 🎨 UI 구조 및 스타일

### 스타일링
- **Tailwind CSS 4**: 유틸리티 기반 CSS
- **다크 모드**: `class` 전략 사용
- **반응형 디자인**: 모바일, 태블릿, 데스크톱 지원

### 주요 UI 패턴

#### 1. 카루셀 (VM 목록)
- 무한 루프 슬라이드
- 중앙 정렬
- 호버 시 액션 버튼 표시
- OS 로고 표시
- 반응형 카드 크기

#### 2. VM 카드
- OS 로고 (상단)
- VM 이름, 스펙, 상태 (중앙)
- 호버 시 액션 버튼 (중앙 영역 대체)
- UUID 표시 (하단)

#### 3. 토스트 알림
- 우측 상단 고정
- 성공/에러/정보/경고 타입
- 자동 사라짐
- 접근성 지원

---

## 🔧 주요 기능 구현

### 1. 인증 플로우

```typescript
// LoginForm.tsx
const handleLogin = async (e) => {
  const response = await authAPI.login({ username, password });
  setToken(response.token);
  router.push('/');
};
```

### 2. VM 상태 실시간 업데이트

```typescript
// page.tsx
useVMWebSocket(
  (vm) => {
    // VM 업데이트 처리
    queryClient.setQueryData(['vms'], (prev) => 
      prev.map(v => v.id === vm.id ? vm : v)
    );
  },
  (vms) => {
    // 전체 VM 목록 업데이트
    queryClient.setQueryData(['vms'], vms);
  },
  true
);
```

### 3. Optimistic Updates

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

---

## 📝 코드 스타일 및 패턴

### 1. 함수형 컴포넌트
- 모든 컴포넌트는 함수형 컴포넌트
- Hooks 사용 (`useState`, `useEffect`, `useCallback`)

### 2. 타입 안정성
- TypeScript 사용
- 모든 API 응답에 인터페이스 정의

### 3. 에러 처리
- try-catch 블록
- Toast로 사용자에게 알림
- ErrorBoundary로 크래시 방지

### 4. 상태 관리
- **서버 상태**: React Query
- **클라이언트 상태**: React Hooks (`useState`, `useContext`)
- **전역 상태**: Context API (Toast, Theme)

### 5. API 호출
- `api.ts`의 함수 사용
- 자동 토큰 포함
- 401 에러 시 자동 로그아웃

---

## 🚀 개발 가이드

### 새 페이지 추가
1. `app/새페이지/page.tsx` 생성
2. 필요시 `layout.tsx`에서 라우팅 설정
3. `AuthGuard`로 보호 필요시 적용

### 새 컴포넌트 추가
1. `components/새컴포넌트.tsx` 생성
2. 필요한 경우 `api.ts`에서 API 함수 추가
3. TypeScript 인터페이스 정의

### API 호출 추가
1. `lib/api.ts`에 함수 추가
2. TypeScript 인터페이스 정의
3. React Query Hook 생성 (선택)
4. 컴포넌트에서 사용

---

## 관련 문서

- [프론트엔드 개요](../00-overview.md)
- [개발 가이드](../02-development/)
- [컴포넌트](../03-components/)
- [Hooks](../04-hooks/)

---

**태그**: `#프론트엔드` `#코드구조` `#아키텍처` `#Next.js`

**카테고리**: 문서 > 프론트엔드 > 아키텍처 > 코드 구조

**마지막 업데이트**: 2024-12-14








