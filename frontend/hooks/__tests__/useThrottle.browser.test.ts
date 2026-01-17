/**
 * useThrottle 훅 테스트
 */

import { renderHook, act } from '@testing-library/react';
import { useThrottle } from '../useThrottle';

describe('useThrottle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should throttle function calls', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useThrottle(mockFn, 300));

    // 첫 번째 호출은 즉시 실행
    act(() => {
      result.current();
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 100ms 후 호출 (delay보다 짧음)
    act(() => {
      jest.advanceTimersByTime(100);
      result.current();
    });
    expect(mockFn).toHaveBeenCalledTimes(1); // 아직 호출되지 않음

    // 200ms 더 진행 (총 300ms)
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(mockFn).toHaveBeenCalledTimes(2); // 이제 호출됨
  });

  it('should use default delay of 300ms', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useThrottle(mockFn));

    act(() => {
      result.current();
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(100);
      result.current();
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to throttled function', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useThrottle(mockFn, 300));

    act(() => {
      result.current('arg1', 'arg2');
    });
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should handle multiple rapid calls', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useThrottle(mockFn, 300));

    // 여러 번 빠르게 호출
    act(() => {
      result.current();
      result.current();
      result.current();
    });
    expect(mockFn).toHaveBeenCalledTimes(1); // 첫 번째만 실행

    // delay 후 마지막 호출 실행
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockFn).toHaveBeenCalledTimes(2); // 마지막 호출 실행
  });

  it('should handle rapid calls correctly', () => {
    const mockFn = jest.fn();
    const { result } = renderHook(() => useThrottle(mockFn, 300));

    act(() => {
      result.current();
      result.current(); // 대기 중인 호출
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    // delay 후 마지막 호출 실행
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});

