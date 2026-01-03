# 테스트 가이드

## 개요

LIMEN 프론트엔드는 Jest와 React Testing Library를 사용하여 테스트를 작성합니다.

## 현재 상태

### 테스트 커버리지

- **전체 커버리지**: 58.22%
  - Statements: 57.25%
  - Branches: 47.41%
  - Functions: 61.4%
  - Lines: 58.22%

### 테스트 통계

- **총 테스트 수**: 437개
- **테스트 스위트**: 68개
- **통과율**: 100% (437 passed, 0 failed)

## 테스트 실행

### 기본 명령어

```bash
# 모든 테스트 실행
npm test

# 커버리지 포함 실행
npm run test:coverage

# Watch 모드 (파일 변경 시 자동 실행)
npm test -- --watch

# 특정 파일만 테스트
npm test -- path/to/test/file.test.tsx

# 특정 패턴의 테스트만 실행
npm test -- --testNamePattern="pattern"
```

### 커버리지 확인

```bash
# 커버리지 리포트 생성
npm run test:coverage

# 커버리지 리포트는 coverage/ 폴더에 생성됩니다
# HTML 리포트: coverage/lcov-report/index.html
```

## 테스트 구조

### 파일 구조

```
frontend/
├── components/
│   ├── __tests__/          # 컴포넌트 테스트
│   │   ├── Button.test.tsx
│   │   ├── LoginForm.test.tsx
│   │   └── ...
│   └── ...
├── hooks/
│   ├── __tests__/          # 훅 테스트
│   │   ├── useDebounce.test.ts
│   │   └── ...
│   └── ...
├── lib/
│   ├── __tests__/          # 유틸리티 테스트
│   │   ├── errorTracking.test.ts
│   │   └── ...
│   └── ...
└── __tests__/
    └── integration/        # 통합 테스트
        ├── auth.test.tsx
        └── ...
```

### 테스트 파일 명명 규칙

- 컴포넌트 테스트: `ComponentName.test.tsx`
- 훅 테스트: `useHookName.test.ts` 또는 `useHookName.test.tsx` (JSX 사용 시)
- 유틸리티 테스트: `utilityName.test.ts`
- 통합 테스트: `featureName.test.tsx`

## 테스트 작성 가이드

### 컴포넌트 테스트

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Component from '../Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    render(<Component />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.getByText('Clicked')).toBeInTheDocument()
    })
  })
})
```

### 훅 테스트

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCustomHook } from '../useCustomHook'

describe('useCustomHook', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useCustomHook())
    expect(result.current.value).toBe(0)
  })

  it('updates value', () => {
    const { result } = renderHook(() => useCustomHook())
    act(() => {
      result.current.increment()
    })
    expect(result.current.value).toBe(1)
  })
})
```

### API 클라이언트 테스트

```typescript
import { apiRequest } from '../lib/api/client'

jest.mock('../lib/api/client')

describe('API Client', () => {
  it('makes GET request', async () => {
    const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>
    mockApiRequest.mockResolvedValue({ data: 'test' })

    const result = await apiRequest('/test')
    expect(result.data).toBe('test')
  })
})
```

## 모킹 가이드

### Next.js 모킹

```typescript
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  usePathname: () => '/dashboard',
  useParams: () => ({ uuid: 'test-uuid' }),
}))
```

### React Query 모킹

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

render(
  <QueryClientProvider client={queryClient}>
    <Component />
  </QueryClientProvider>
)
```

### API 모킹

```typescript
jest.mock('../lib/api', () => ({
  authAPI: {
    login: jest.fn(),
    register: jest.fn(),
  },
  vmAPI: {
    list: jest.fn(),
    action: jest.fn(),
  },
}))
```

## 테스트 커버리지 목표

### 현재 목표

- **단기 목표**: 60%
- **중기 목표**: 80%
- **장기 목표**: 90%

### 커버리지 우선순위

1. **높음**: 핵심 비즈니스 로직, API 클라이언트, 인증 모듈
2. **중간**: 컴포넌트, 훅, 유틸리티 함수
3. **낮음**: UI 컴포넌트, 스타일링

## 완료된 테스트 영역

### ✅ 완료된 테스트

1. **유틸리티 함수**
   - format.ts, validation.ts, error.ts
   - token.ts, errorHelpers.ts, logger.ts
   - security.ts, analytics.ts

2. **인증 모듈**
   - auth/index.ts
   - tokenManager.ts

3. **코어 모듈**
   - webVitals.ts, queryClient.ts
   - errorTracking.ts

4. **Hooks**
   - useDebounce, useThrottle, useMounted
   - useOptimisticUpdate, useQuota, useVMs
   - useAdminUsers, useAgentMetrics

5. **컴포넌트**
   - Button, Input, Toast, Loading, Skeleton
   - StatusCard, QuotaDisplay, AgentMetricsCard
   - ThemeToggle, HealthStatus, LoginForm, RegisterForm
   - ToastContainer, ThemeProvider, ErrorBoundary
   - QueryProvider, WebVitalsClient, PWARegister
   - SnapshotManager, AuthGuard, VMListSection, VNCViewer

6. **API 클라이언트**
   - client, quota, admin, snapshot, vm, auth, index

7. **페이지 컴포넌트**
   - app/page.tsx, app/error.tsx
   - app/login/page.tsx, app/register/page.tsx
   - app/(protected)/dashboard/page.tsx
   - app/(protected)/vnc/[uuid]/page.tsx
   - app/offline/page.tsx
   - app/(protected)/admin/users/page.tsx

8. **통합 테스트**
   - 인증 통합 테스트
   - VM 관리 통합 테스트
   - 스냅샷 관리 통합 테스트

## 다음 단계

### 추가 테스트 필요 영역

1. **컴포넌트 추가 시나리오**
   - 엣지 케이스 테스트
   - 에러 처리 시나리오
   - 사용자 인터랙션 시나리오

2. **통합 테스트 확장**
   - 전체 사용자 플로우 테스트
   - API 통합 테스트
   - 인증 플로우 테스트

3. **성능 테스트**
   - 렌더링 성능 테스트
   - 메모리 누수 테스트

## 문제 해결

### 일반적인 문제

1. **act() 경고**
   ```typescript
   import { act } from '@testing-library/react'
   
   await act(async () => {
     // 비동기 작업
   })
   ```

2. **모킹 문제**
   - 모킹은 파일 상단에 배치
   - jest.clearAllMocks()를 beforeEach에서 호출

3. **비동기 테스트**
   ```typescript
   await waitFor(() => {
     expect(element).toBeInTheDocument()
   }, { timeout: 3000 })
   ```

## 참고 자료

- [Jest 공식 문서](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library 쿼리 우선순위](https://testing-library.com/docs/queries/about/#priority)

---

**마지막 업데이트**: 2025-01-15
