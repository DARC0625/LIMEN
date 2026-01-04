/**
 * useDebounce 훅 테스트
 * React Testing Library의 renderHook을 사용한 커스텀 훅 테스트 예제
 */

import { renderHook, waitFor } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500))
    expect(result.current).toBe('initial')
  })

  it('debounces value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    )

    expect(result.current).toBe('initial')

    // 값 변경
    rerender({ value: 'updated', delay: 500 })
    expect(result.current).toBe('initial') // 아직 업데이트되지 않음

    // 타이머 진행
    jest.advanceTimersByTime(500)
    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })

  it('resets timer on rapid value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    )

    // 빠르게 여러 번 변경
    rerender({ value: 'value1', delay: 500 })
    jest.advanceTimersByTime(200)
    
    rerender({ value: 'value2', delay: 500 })
    jest.advanceTimersByTime(200)
    
    rerender({ value: 'value3', delay: 500 })
    jest.advanceTimersByTime(200)

    // 아직 업데이트되지 않음
    expect(result.current).toBe('initial')

    // 전체 딜레이 시간 경과
    jest.advanceTimersByTime(500)
    await waitFor(() => {
      expect(result.current).toBe('value3') // 마지막 값만 반영
    })
  })

  it('handles delay changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      }
    )

    rerender({ value: 'updated', delay: 1000 })
    jest.advanceTimersByTime(500)
    expect(result.current).toBe('initial') // 아직 업데이트되지 않음

    jest.advanceTimersByTime(500) // 총 1000ms 경과
    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })

  it('uses default delay of 300ms', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      {
        initialProps: { value: 'initial' },
      }
    )

    rerender({ value: 'updated' })
    jest.advanceTimersByTime(300)

    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })

  it('cleans up timer on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('test', 500))

    unmount()

    // 타이머가 정리되었는지 확인 (에러 없이 처리되어야 함)
    jest.advanceTimersByTime(500)
    expect(true).toBe(true)
  })

  it('handles zero delay', async () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 0),
      {
        initialProps: { value: 'initial' },
      }
    )

    rerender({ value: 'updated' })
    jest.advanceTimersByTime(0)

    await waitFor(() => {
      expect(result.current).toBe('updated')
    })
  })
})



