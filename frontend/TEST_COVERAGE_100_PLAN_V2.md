# LIMEN 프론트엔드 테스트 커버리지 100% 달성 계획 V2

**작성일**: 2026-01-03  
**현재 상태**: 약 70% 커버리지, 6개 테스트 실패  
**목표**: 100% 커버리지 달성 + 모든 테스트 통과

---

## 📊 현재 상태 분석

### 테스트 현황
- **총 테스트 스위트**: 74개
- **총 테스트**: 674개
- **통과**: 668개 ✅
- **실패**: 6개 ❌

### 실패하는 테스트 목록
1. `components/__tests__/RevolverPicker.test.tsx` - cancelAnimationFrame on unmount
2. `lib/__tests__/tokenManager.test.ts` - handles concurrent token refresh requests
3. `app/__tests__/page.test.tsx` - redirects to login page (2개 테스트)
4. `lib/auth/__tests__/index.test.ts` - handles 401/403 status (2개 테스트)

### 커버리지 추정 (기존 문서 기준)
- **Statements**: ~70.85% → 목표: 100%
- **Branches**: ~60.47% → 목표: 100%
- **Functions**: ~73.72% → 목표: 100%
- **Lines**: ~71.99% → 목표: 100%

---

## 🎯 단계별 실행 계획

### Phase 0: 실패하는 테스트 수정 (우선순위: P0) ⚠️

**목표**: 모든 테스트가 통과하도록 수정

#### 0.1 RevolverPicker 테스트 수정
- **파일**: `components/__tests__/RevolverPicker.test.tsx`
- **문제**: `expect(container).toBeInTheDocument()` 실패 - unmount 후 컨테이너가 DOM에서 제거됨
- **해결 방안**:
  ```typescript
  // unmount 전에 cancelAnimationFrame 호출 확인
  const frameId = mockRequestAnimationFrame.mock.results[0]?.value
  if (frameId) {
    expect(mockCancelAnimationFrame).toHaveBeenCalledWith(frameId)
  }
  unmount()
  // unmount 후에는 컨테이너가 DOM에 없으므로 다른 방식으로 검증
  ```

#### 0.2 tokenManager 테스트 수정
- **파일**: `lib/__tests__/tokenManager.test.ts`
- **문제**: `authAPI.refreshToken.mockRejectedValue` - 모킹이 제대로 설정되지 않음
- **해결 방안**:
  ```typescript
  // 모킹을 beforeEach에서 설정하고, 각 테스트에서 재설정
  beforeEach(() => {
    jest.clearAllMocks()
    // authAPI 모킹 재설정
  })
  ```

#### 0.3 page.test.tsx 리다이렉트 테스트 수정
- **파일**: `app/__tests__/page.test.tsx`
- **문제**: `mockRouter.replace`가 예상대로 호출되지 않음
- **해결 방안**:
  ```typescript
  // Next.js 라우터 모킹 개선
  // 또는 실제 라우터 동작을 시뮬레이션하는 방식으로 변경
  ```

#### 0.4 auth/index.test.ts 401/403 테스트 수정
- **파일**: `lib/auth/__tests__/index.test.ts`
- **문제**: 401/403 상태 코드 처리 테스트 실패
- **해결 방안**:
  ```typescript
  // fetch 모킹 개선
  // 응답 상태 코드를 정확히 시뮬레이션
  ```

**예상 소요 시간**: 2-3시간  
**완료 기준**: `npm test` 실행 시 모든 테스트 통과

---

### Phase 1: 커버리지 측정 및 분석 (우선순위: P0)

**목표**: 현재 커버리지 정확히 측정하고 누락된 파일/라인 식별

#### 1.1 커버리지 리포트 생성
```bash
npm run test:coverage
```

#### 1.2 커버리지 리포트 분석
- `coverage/coverage-summary.json` 확인
- 각 파일별 커버리지 확인
- 0% 또는 낮은 커버리지 파일 목록 작성

#### 1.3 누락된 파일 식별
- 테스트 파일이 없는 소스 파일 목록 작성
- 커버리지가 50% 미만인 파일 우선순위 지정

**예상 소요 시간**: 30분  
**완료 기준**: 커버리지 리포트 생성 및 분석 완료

---

### Phase 2: 테스트되지 않은 컴포넌트 테스트 작성 (우선순위: P1)

**목표**: 테스트 파일이 없는 컴포넌트에 대한 테스트 작성

#### 2.1 우선순위 높은 컴포넌트 (비즈니스 로직 포함)
1. **VNCViewer.tsx** (현재 ~22% 커버리지)
   - WebSocket 연결 테스트
   - 키보드/마우스 이벤트 테스트
   - 에러 처리 테스트
   - 파일: `components/__tests__/VNCViewer.test.tsx`

2. **VMListSection.tsx** (현재 ~44% 커버리지)
   - VM 목록 렌더링 테스트
   - 필터링/정렬 테스트
   - 액션 버튼 테스트
   - 파일: `components/__tests__/VMListSection.test.tsx`

3. **LoginForm.tsx** (현재 ~45% 커버리지)
   - 폼 제출 테스트
   - 에러 메시지 표시 테스트
   - 오프라인 모드 테스트
   - 파일: `components/__tests__/LoginForm.test.tsx` (확장)

4. **AuthGuard.tsx** (현재 ~52% 커버리지)
   - 인증 상태별 리다이렉트 테스트
   - 로딩 상태 테스트
   - 파일: `components/__tests__/AuthGuard.test.tsx` (확장)

#### 2.2 UI 컴포넌트 (우선순위: 중)
1. **ThemeToggle.tsx**
   - 테마 전환 테스트
   - 파일: `components/__tests__/ThemeToggle.test.tsx`

2. **Loading.tsx**
   - 로딩 상태 렌더링 테스트
   - 파일: `components/__tests__/Loading.test.tsx`

3. **Skeleton.tsx**
   - 스켈레톤 렌더링 테스트
   - 파일: `components/__tests__/Skeleton.test.tsx`

4. **Toast.tsx / ToastContainer.tsx**
   - 토스트 표시/제거 테스트
   - 파일: `components/__tests__/Toast.test.tsx`

5. **ErrorDisplay.tsx / ErrorBoundary.tsx**
   - 에러 표시 테스트
   - 에러 바운더리 동작 테스트
   - 파일: `components/__tests__/ErrorDisplay.test.tsx`, `components/__tests__/ErrorBoundary.test.tsx`

#### 2.3 기능 컴포넌트
1. **RegisterForm.tsx**
   - 회원가입 폼 테스트
   - 파일: `components/__tests__/RegisterForm.test.tsx`

2. **HealthStatus.tsx**
   - 헬스 상태 표시 테스트
   - 파일: `components/__tests__/HealthStatus.test.tsx`

3. **StatusCard.tsx**
   - 상태 카드 렌더링 테스트
   - 파일: `components/__tests__/StatusCard.test.tsx`

4. **QuotaDisplay.tsx**
   - 할당량 표시 테스트
   - 파일: `components/__tests__/QuotaDisplay.test.tsx`

5. **AgentMetricsCard.tsx**
   - 메트릭 카드 테스트
   - 파일: `components/__tests__/AgentMetricsCard.test.tsx`

6. **SnapshotManager.tsx**
   - 스냅샷 관리 테스트
   - 파일: `components/__tests__/SnapshotManager.test.tsx`

7. **VersionInfo.tsx**
   - 버전 정보 표시 테스트
   - 파일: `components/__tests__/VersionInfo.test.tsx`

8. **PWARegister.tsx**
   - PWA 등록 테스트
   - 파일: `components/__tests__/PWARegister.test.tsx`

9. **WebVitalsClient.tsx**
   - Web Vitals 수집 테스트
   - 파일: `components/__tests__/WebVitalsClient.test.tsx`

10. **QueryProvider.tsx / ThemeProvider.tsx**
    - Provider 래퍼 테스트
    - 파일: `components/__tests__/QueryProvider.test.tsx`, `components/__tests__/ThemeProvider.test.tsx`

**예상 소요 시간**: 20-30시간 (컴포넌트당 1-2시간)  
**완료 기준**: 모든 컴포넌트에 최소 1개 이상의 테스트 파일 존재

---

### Phase 3: 테스트되지 않은 Hooks 테스트 작성 (우선순위: P1)

**목표**: 테스트 파일이 없는 또는 커버리지가 낮은 hooks에 대한 테스트 작성

#### 3.1 커스텀 Hooks
1. **useAgentMetrics.ts**
   - 메트릭 데이터 페칭 테스트
   - 파일: `hooks/__tests__/useAgentMetrics.test.tsx`

2. **useAdminUsers.ts**
   - 관리자 사용자 목록 테스트
   - 파일: `hooks/__tests__/useAdminUsers.test.tsx`

3. **useQuota.ts**
   - 할당량 조회 테스트
   - 파일: `hooks/__tests__/useQuota.test.tsx`

4. **useMounted.ts**
   - 마운트 상태 테스트
   - 파일: `hooks/__tests__/useMounted.test.tsx`

5. **useDebounce.ts / useThrottle.ts**
   - 디바운스/스로틀 동작 테스트
   - 파일: `hooks/__tests__/useDebounce.test.tsx`, `hooks/__tests__/useThrottle.test.tsx`

6. **useOptimisticUpdate.ts**
   - 낙관적 업데이트 테스트
   - 파일: `hooks/__tests__/useOptimisticUpdate.test.tsx`

7. **useVMs.ts** (확장)
   - 현재 ~78% 커버리지, 엣지 케이스 추가
   - 파일: `hooks/__tests__/useVMs.test.tsx` (확장)

**예상 소요 시간**: 10-15시간  
**완료 기준**: 모든 hooks에 대한 테스트 파일 존재 및 커버리지 80% 이상

---

### Phase 4: 테스트되지 않은 Lib 파일 테스트 작성 (우선순위: P1)

**목표**: lib 디렉토리의 모든 파일에 대한 테스트 작성

#### 4.1 API 관련
1. **lib/api/client.ts** (현재 ~73% 커버리지)
   - HTTP 클라이언트 테스트
   - 에러 처리 테스트
   - 파일: `lib/__tests__/api/client.test.ts` (확장)

2. **lib/api/auth.ts** (현재 ~81% 커버리지)
   - 인증 API 테스트 확장
   - 파일: `lib/__tests__/api/auth.test.ts` (확장)

3. **lib/tokenManager.ts** (현재 ~84% 커버리지)
   - 토큰 관리 테스트 확장
   - 파일: `lib/__tests__/tokenManager.test.ts` (확장)

#### 4.2 유틸리티
1. **lib/errorTracking.ts**
   - 에러 추적 테스트
   - 파일: `lib/__tests__/errorTracking.test.ts`

2. **lib/webVitals.ts** (현재 ~69% 커버리지)
   - Web Vitals 수집 테스트 확장
   - 파일: `lib/__tests__/webVitals.test.ts` (확장)

3. **lib/analytics.ts** (현재 ~87% 커버리지)
   - 분석 이벤트 테스트 확장
   - 파일: `lib/__tests__/analytics.test.ts` (확장)

4. **lib/security.ts** (현재 ~88% 커버리지)
   - 보안 유틸리티 테스트 확장
   - 파일: `lib/__tests__/security.test.ts` (확장)

5. **lib/queryClient.ts**
   - React Query 클라이언트 테스트
   - 파일: `lib/__tests__/queryClient.test.ts`

6. **lib/constants/index.ts**
   - 상수 값 테스트 (간단)
   - 파일: `lib/__tests__/constants.test.ts`

#### 4.3 Auth 관련
1. **lib/auth/index.ts** (현재 ~72% 커버리지)
   - 인증 체크 테스트 확장
   - 파일: `lib/auth/__tests__/index.test.ts` (확장)

**예상 소요 시간**: 15-20시간  
**완료 기준**: 모든 lib 파일에 대한 테스트 파일 존재 및 커버리지 90% 이상

---

### Phase 5: 테스트되지 않은 Pages 테스트 작성 (우선순위: P2)

**목표**: app 디렉토리의 모든 페이지에 대한 테스트 작성

#### 5.1 공개 페이지
1. **app/page.tsx** (메인 페이지)
   - 렌더링 테스트
   - Waitlist 폼 테스트
   - 파일: `app/__tests__/page.test.tsx` (확장)

2. **app/login/page.tsx**
   - 로그인 페이지 렌더링 테스트
   - 파일: `app/login/__tests__/page.test.tsx`

3. **app/register/page.tsx**
   - 회원가입 페이지 렌더링 테스트
   - 파일: `app/register/__tests__/page.test.tsx`

4. **app/offline/page.tsx**
   - 오프라인 페이지 테스트
   - 파일: `app/offline/__tests__/page.test.tsx`

5. **app/status/page.tsx**
   - 상태 페이지 테스트
   - 파일: `app/status/__tests__/page.test.tsx`

6. **app/terms/page.tsx**
   - 이용약관 페이지 테스트
   - 파일: `app/terms/__tests__/page.test.tsx`

7. **app/privacy/page.tsx**
   - 개인정보 처리방침 페이지 테스트
   - 파일: `app/privacy/__tests__/page.test.tsx`

#### 5.2 보호된 페이지
1. **app/(protected)/dashboard/page.tsx**
   - 대시보드 페이지 테스트
   - 파일: `app/(protected)/dashboard/__tests__/page.test.tsx`

2. **app/(protected)/vnc/[uuid]/page.tsx**
   - VNC 페이지 테스트
   - 파일: `app/(protected)/vnc/[uuid]/__tests__/page.test.tsx`

3. **app/(protected)/waiting/page.tsx**
   - 대기 페이지 테스트
   - 파일: `app/(protected)/waiting/__tests__/page.test.tsx`

4. **app/(protected)/admin/users/page.tsx**
   - 관리자 사용자 페이지 테스트
   - 파일: `app/(protected)/admin/users/__tests__/page.test.tsx` (확장)

#### 5.3 API Routes
1. **app/api/public/waitlist/route.ts**
   - Waitlist API 테스트
   - Rate limiting 테스트
   - 파일: `app/api/public/waitlist/__tests__/route.test.ts`

#### 5.4 에러 페이지
1. **app/error.tsx**
   - 에러 페이지 테스트
   - 파일: `app/__tests__/error.test.tsx`

**예상 소요 시간**: 15-20시간  
**완료 기준**: 모든 페이지에 대한 테스트 파일 존재

---

### Phase 6: 브랜치 커버리지 향상 (우선순위: P1)

**목표**: 모든 조건문, 반복문, 예외 처리 경로 테스트

#### 6.1 조건문 커버리지
- if/else 문의 모든 분기 테스트
- switch 문의 모든 case 테스트
- 삼항 연산자 분기 테스트

#### 6.2 반복문 커버리지
- 빈 배열 처리 테스트
- 단일 요소 배열 테스트
- 다중 요소 배열 테스트

#### 6.3 예외 처리 커버리지
- try/catch 블록의 모든 경로 테스트
- 에러 케이스 시뮬레이션

**예상 소요 시간**: 10-15시간  
**완료 기준**: 브랜치 커버리지 95% 이상

---

### Phase 7: 최종 검증 및 100% 달성 (우선순위: P0)

**목표**: 모든 파일의 커버리지 100% 달성

#### 7.1 커버리지 리포트 재생성
```bash
npm run test:coverage
```

#### 7.2 누락된 라인 확인
- `coverage/lcov-report/index.html` 확인
- 커버리지가 100% 미만인 파일 목록 작성

#### 7.3 추가 테스트 작성
- 누락된 라인에 대한 테스트 작성
- 엣지 케이스 추가 테스트

#### 7.4 최종 검증
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

**예상 소요 시간**: 5-10시간  
**완료 기준**: 모든 커버리지 지표 100% 달성

---

## 📋 우선순위 요약

### 즉시 시작 (P0)
1. ✅ Phase 0: 실패하는 테스트 수정
2. ✅ Phase 1: 커버리지 측정 및 분석
3. ✅ Phase 7: 최종 검증 (반복)

### 단기 목표 (P1, 1-2주)
1. Phase 2: 컴포넌트 테스트 작성
2. Phase 3: Hooks 테스트 작성
3. Phase 4: Lib 파일 테스트 작성
4. Phase 6: 브랜치 커버리지 향상

### 중기 목표 (P2, 2-3주)
1. Phase 5: Pages 테스트 작성

---

## 🛠️ 테스트 작성 가이드라인

### 컴포넌트 테스트
```typescript
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Component from '../Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })

  it('handles user interaction', async () => {
    const user = userEvent.setup()
    render(<Component />)
    await user.click(screen.getByRole('button'))
    // assertions
  })

  it('handles edge cases', () => {
    // edge case tests
  })
})
```

### Hook 테스트
```typescript
import { renderHook, act } from '@testing-library/react'
import { useCustomHook } from '../useCustomHook'

describe('useCustomHook', () => {
  it('returns initial value', () => {
    const { result } = renderHook(() => useCustomHook())
    expect(result.current.value).toBe(initialValue)
  })

  it('updates value on action', () => {
    const { result } = renderHook(() => useCustomHook())
    act(() => {
      result.current.updateValue('new value')
    })
    expect(result.current.value).toBe('new value')
  })
})
```

### API/유틸리티 테스트
```typescript
import { functionToTest } from '../functionToTest'

describe('functionToTest', () => {
  it('handles normal case', () => {
    const result = functionToTest(input)
    expect(result).toBe(expectedOutput)
  })

  it('handles error case', () => {
    expect(() => functionToTest(invalidInput)).toThrow()
  })
})
```

---

## 📊 진행 상황 추적

### 체크리스트

#### Phase 0: 실패하는 테스트 수정
- [ ] RevolverPicker 테스트 수정
- [ ] tokenManager 테스트 수정
- [ ] page.test.tsx 리다이렉트 테스트 수정
- [ ] auth/index.test.ts 401/403 테스트 수정

#### Phase 1: 커버리지 측정
- [ ] 커버리지 리포트 생성
- [ ] 커버리지 분석 완료
- [ ] 누락된 파일 목록 작성

#### Phase 2: 컴포넌트 테스트 (총 20개)
- [ ] VNCViewer.tsx
- [ ] VMListSection.tsx
- [ ] LoginForm.tsx (확장)
- [ ] AuthGuard.tsx (확장)
- [ ] ThemeToggle.tsx
- [ ] Loading.tsx
- [ ] Skeleton.tsx
- [ ] Toast.tsx / ToastContainer.tsx
- [ ] ErrorDisplay.tsx / ErrorBoundary.tsx
- [ ] RegisterForm.tsx
- [ ] HealthStatus.tsx
- [ ] StatusCard.tsx
- [ ] QuotaDisplay.tsx
- [ ] AgentMetricsCard.tsx
- [ ] SnapshotManager.tsx
- [ ] VersionInfo.tsx
- [ ] PWARegister.tsx
- [ ] WebVitalsClient.tsx
- [ ] QueryProvider.tsx
- [ ] ThemeProvider.tsx

#### Phase 3: Hooks 테스트 (총 7개)
- [ ] useAgentMetrics.ts
- [ ] useAdminUsers.ts
- [ ] useQuota.ts
- [ ] useMounted.ts
- [ ] useDebounce.ts
- [ ] useThrottle.ts
- [ ] useOptimisticUpdate.ts
- [ ] useVMs.ts (확장)

#### Phase 4: Lib 파일 테스트 (총 10개)
- [ ] lib/api/client.ts (확장)
- [ ] lib/api/auth.ts (확장)
- [ ] lib/tokenManager.ts (확장)
- [ ] lib/errorTracking.ts
- [ ] lib/webVitals.ts (확장)
- [ ] lib/analytics.ts (확장)
- [ ] lib/security.ts (확장)
- [ ] lib/queryClient.ts
- [ ] lib/constants/index.ts
- [ ] lib/auth/index.ts (확장)

#### Phase 5: Pages 테스트 (총 12개)
- [ ] app/page.tsx (확장)
- [ ] app/login/page.tsx
- [ ] app/register/page.tsx
- [ ] app/offline/page.tsx
- [ ] app/status/page.tsx
- [ ] app/terms/page.tsx
- [ ] app/privacy/page.tsx
- [ ] app/(protected)/dashboard/page.tsx
- [ ] app/(protected)/vnc/[uuid]/page.tsx
- [ ] app/(protected)/waiting/page.tsx
- [ ] app/(protected)/admin/users/page.tsx (확장)
- [ ] app/api/public/waitlist/route.ts
- [ ] app/error.tsx

#### Phase 6: 브랜치 커버리지
- [ ] 조건문 모든 분기 테스트
- [ ] 반복문 엣지 케이스 테스트
- [ ] 예외 처리 경로 테스트

#### Phase 7: 최종 검증
- [ ] 커버리지 리포트 재생성
- [ ] Statements: 100%
- [ ] Branches: 100%
- [ ] Functions: 100%
- [ ] Lines: 100%

---

## ⏱️ 예상 일정

### Week 1 (Phase 0-1)
- 실패하는 테스트 수정
- 커버리지 측정 및 분석
- **목표**: 모든 테스트 통과 + 현재 상태 정확히 파악

### Week 2-3 (Phase 2-3)
- 컴포넌트 테스트 작성 (20개)
- Hooks 테스트 작성 (7개)
- **목표**: 컴포넌트/Hooks 커버리지 90% 이상

### Week 4-5 (Phase 4-6)
- Lib 파일 테스트 작성 (10개)
- 브랜치 커버리지 향상
- **목표**: Lib 커버리지 95% 이상, 브랜치 커버리지 95% 이상

### Week 6 (Phase 5)
- Pages 테스트 작성 (12개)
- **목표**: Pages 커버리지 90% 이상

### Week 7 (Phase 7)
- 최종 검증 및 100% 달성
- **목표**: 모든 커버리지 지표 100%

**총 예상 소요 시간**: 7주 (약 80-120시간)

---

## 🎯 성공 기준

1. ✅ 모든 테스트 통과 (0개 실패)
2. ✅ Statements 커버리지: 100%
3. ✅ Branches 커버리지: 100%
4. ✅ Functions 커버리지: 100%
5. ✅ Lines 커버리지: 100%
6. ✅ CI/CD 파이프라인에서 자동으로 커버리지 검증

---

## 📝 참고사항

### 제외 대상
- `middleware.ts` - Next.js 미들웨어는 테스트 환경에서 실행 어려움
- `rag-client.ts.example` - 예제 파일
- `*.d.ts` - 타입 정의 파일
- `node_modules/`, `.next/` - 빌드 산출물

### 테스트 작성 시 주의사항
1. **실제 사용 시나리오 반영**: 실제 사용자 동작을 시뮬레이션
2. **엣지 케이스 포함**: 빈 값, null, undefined, 에러 케이스
3. **모킹 최소화**: 가능한 한 실제 구현 사용
4. **테스트 격리**: 각 테스트는 독립적으로 실행 가능해야 함
5. **명확한 테스트 이름**: 무엇을 테스트하는지 명확히 표현

---

## 🔄 업데이트 이력

- **2026-01-03**: 초안 작성 (V2)
  - 현재 상태 분석
  - 단계별 계획 수립
  - 우선순위 지정

---

**다음 단계**: Phase 0부터 시작하여 실패하는 테스트를 수정하고, 커버리지를 정확히 측정합니다.



