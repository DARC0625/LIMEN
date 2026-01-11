/**
 * useMounted 훅 테스트
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useMounted } from '../useMounted';

describe('useMounted', () => {
  it('should return true after mount', async () => {
    const { result } = renderHook(() => useMounted());
    
    // useEffect가 실행되기를 기다림
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('should maintain true after multiple rerenders', async () => {
    const { result, rerender } = renderHook(() => useMounted());
    
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    
    rerender();
    expect(result.current).toBe(true);
    
    rerender();
    expect(result.current).toBe(true);
  });

  it('should return true consistently', async () => {
    const { result } = renderHook(() => useMounted());
    
    await waitFor(() => {
      expect(result.current).toBe(true);
    });
    
    // 여러 번 확인해도 항상 true
    expect(result.current).toBe(true);
    expect(result.current).toBe(true);
  });
});

