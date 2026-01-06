# 프론트엔드 테스트 가이드

**작성일**: 2025-01-14

---

## 📋 개요

LIMEN 프론트엔드는 **Jest**와 **React Testing Library**를 사용하여 테스트를 작성합니다.

---

## 🚀 시작하기

### 1. 의존성 설치

```bash
cd frontend
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom
```

### 2. 테스트 실행

```bash
# 모든 테스트 실행
npm test

# Watch 모드 (파일 변경 시 자동 실행)
npm run test:watch

# 커버리지 리포트 생성
npm run test:coverage
```

---

## 📁 테스트 파일 구조

```
frontend/
├── components/
│   ├── __tests__/
│   │   └── Button.test.tsx
│   └── ui/
│       └── Button.tsx
├── hooks/
│   ├── __tests__/
│   │   └── useDebounce.test.ts
│   └── useDebounce.ts
└── jest.config.js
```

---

## ✍️ 테스트 작성 예제

### 컴포넌트 테스트

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import Button from '../ui/Button'

describe('Button', () => {
  it('renders button with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick handler when clicked', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### 커스텀 훅 테스트

```typescript
import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  it('debounces value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    )

    expect(result.current).toBe('initial')

    rerender({ value: 'updated', delay: 500 })
    jest.advanceTimersByTime(500)
    
    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })
})
```

---

## 🎯 테스트 작성 가이드

### 우선순위

1. **공통 컴포넌트** (`components/ui/`)
   - Button, Input 등 재사용 가능한 컴포넌트

2. **커스텀 훅** (`hooks/`)
   - useDebounce, useThrottle, useOptimisticUpdate 등

3. **비즈니스 로직** (`lib/`)
   - API 클라이언트, 유틸리티 함수

4. **페이지 컴포넌트** (`app/`)
   - 주요 페이지 컴포넌트

### 테스트 작성 원칙

1. **사용자 관점에서 테스트**
   - 사용자가 보는 것, 하는 것에 집중
   - 구현 세부사항보다 동작에 집중

2. **접근성 고려**
   - `getByRole`, `getByLabelText` 등 접근성 API 사용
   - `getByTestId`는 최후의 수단으로만 사용

3. **명확한 테스트 이름**
   - "should render button" ❌
   - "renders button with children" ✅

---

## 📊 커버리지 목표

- **현재**: 0% (테스트 시작 단계)
- **목표**: 80% 이상
- **우선순위**: 공통 컴포넌트 및 훅 100% 커버리지

---

## 🔧 설정 파일

### jest.config.js
- Next.js 통합 설정
- 경로 별칭 설정
- 커버리지 수집 범위

### jest.setup.js
- 전역 설정
- Next.js router 모킹
- window.matchMedia 모킹

---

## 📚 참고 자료

- [Jest 공식 문서](https://jestjs.io/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library 쿼리 우선순위](https://testing-library.com/docs/queries/about/#priority)

---

**작성자**: AI Assistant  
**최종 업데이트**: 2025-01-14




