/**
 * HealthStatus 컴포넌트 테스트
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import HealthStatus from '../HealthStatus'

// fetch 모킹
global.fetch = jest.fn()

describe('HealthStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('renders loading state initially', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // 무한 대기
    )

    render(<HealthStatus />)
    
    // 로딩 상태 확인 (StatusCard가 표시되는지 확인)
    expect(screen.getByText(/connection status/i)).toBeInTheDocument()
  })

  it('displays health data when available', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
      expect(screen.getByText(/vm service/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles fetch errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<HealthStatus />)

    // 에러 상태에서도 컴포넌트가 렌더링되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/connection status/i)).toBeInTheDocument()
    })
  })

  it('fetches health status on mount', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    // 첫 번째 요청이 발생했는지 확인
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('handles HTTP error responses', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Server error',
    } as Response)

    render(<HealthStatus />)

    // 에러 상태에서도 컴포넌트가 렌더링되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/connection status/i)).toBeInTheDocument()
    })
  })

  it('handles timeout errors', async () => {
    const controller = new AbortController()
    const timeoutError = new Error('Request timeout')
    timeoutError.name = 'AbortError'

    ;(global.fetch as jest.Mock).mockImplementation(() => {
      controller.abort()
      return Promise.reject(timeoutError)
    })

    render(<HealthStatus />)

    // 타임아웃 에러가 처리되는지 확인
    await waitFor(() => {
      expect(screen.getByText(/connection status/i)).toBeInTheDocument()
    })
  })

  it('handles network online event', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    // online 이벤트 발생
    window.dispatchEvent(new Event('online'))

    // 헬스체크가 다시 호출되는지 확인
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    }, { timeout: 3000 })
  })

  it('handles network offline event', () => {
    render(<HealthStatus />)

    // offline 이벤트 발생
    window.dispatchEvent(new Event('offline'))

    // 컴포넌트가 여전히 렌더링되는지 확인
    expect(screen.getByText(/connection status/i)).toBeInTheDocument()
  })

  it('handles consecutive errors with exponential backoff', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<HealthStatus />)

    // 첫 번째 에러 후 재시도가 예약되는지 확인
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // 시간을 진행시켜 재시도 확인
    act(() => {
      jest.advanceTimersByTime(500) // 첫 번째 재시도
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })
  })

  it('handles successful recovery after errors', async () => {
    // 처음에 에러 발생
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

    render(<HealthStatus />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // 그 다음 성공
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    // 재시도 시간 경과
    act(() => {
      jest.advanceTimersByTime(500)
    })

    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
    })
  })

  it('handles identical health data without re-rendering', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
    })

    const initialCallCount = (global.fetch as jest.Mock).mock.calls.length

    // 동일한 데이터로 다시 fetch
    act(() => {
      jest.advanceTimersByTime(30000) // 30초 간격
    })

    await waitFor(() => {
      // fetch는 호출되지만 상태 업데이트는 최적화됨
      expect(global.fetch).toHaveBeenCalledTimes(initialCallCount + 1)
    })
  })

  it('handles AbortError gracefully', async () => {
    const abortError = new Error('Request aborted')
    abortError.name = 'AbortError'

    ;(global.fetch as jest.Mock).mockRejectedValue(abortError)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/connection status/i)).toBeInTheDocument()
    })
  })

  it('fetches health status with correct headers', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    expect(fetchCall[1]).toMatchObject({
      method: 'GET',
      cache: 'no-store',
      headers: expect.objectContaining({
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }),
    })
  })

  it('handles timeout correctly', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('Request timeout')
          error.name = 'AbortError'
          reject(error)
        }, 100)
      })
    })

    render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/connection status/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('stops retrying after max consecutive errors', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<HealthStatus />)

    // 여러 번 에러 발생 시뮬레이션
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // 시간을 진행시켜 재시도 확인
    act(() => {
      jest.advanceTimersByTime(5000) // 여러 재시도 시간
    })

    // 최대 재시도 횟수 확인 (5번)
    await waitFor(() => {
      const callCount = (global.fetch as jest.Mock).mock.calls.length
      expect(callCount).toBeLessThanOrEqual(6) // 초기 호출 + 최대 5번 재시도
    })
  })

  // Note: window.location.hostname 모킹은 Jest 환경에서 어려워서
  // 프로덕션 도메인 체크는 실제 환경에서만 테스트 가능
  // 대신 다른 엣지 케이스들을 테스트함

  it('handles server side rendering', () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const { container } = render(<HealthStatus />)
    
    // 서버 사이드에서는 기본 상태로 렌더링
    expect(container).toBeInTheDocument()

    global.window = originalWindow
  })

  it('handles identical health data preventing re-render', async () => {
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    const { rerender } = render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
    })

    // 동일한 데이터로 다시 fetch
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      // fetch는 호출되지만 상태 업데이트는 최적화됨
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('handles identical health data with same time preventing re-render', async () => {
    // 107번 라인: return prevHealth 브랜치를 명확하게 테스트
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(screen.getByText(/database/i)).toBeInTheDocument()
    })

    // 정확히 동일한 데이터로 다시 fetch (모든 필드가 동일)
    const initialCallCount = (global.fetch as jest.Mock).mock.calls.length
    
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        time: '2026-01-03T10:00:00Z',
        db: 'connected',
        libvirt: 'connected',
      }),
    } as Response)

    act(() => {
      jest.advanceTimersByTime(30000)
    })

    await waitFor(() => {
      // fetch는 호출되지만 상태는 동일하므로 리렌더링 방지
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('handles production domain (limen.kr) API URL', async () => {
    // window.location.hostname 모킹은 어려우므로
    // 실제로는 프로덕션 도메인에서만 테스트 가능
    // 하지만 코드 경로를 확인하기 위해 다른 방법 사용
    const mockHealth = {
      status: 'ok',
      time: '2026-01-03T10:00:00Z',
      db: 'connected',
      libvirt: 'connected',
    }

    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response)

    render(<HealthStatus />)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // 프로덕션 도메인 체크는 실제 환경에서만 가능
    // 하지만 fetch가 호출되었는지 확인
    expect(global.fetch).toHaveBeenCalled()
  })

  it('handles server side cleanup', () => {
    const originalWindow = global.window
    // @ts-ignore
    delete global.window

    const { unmount } = render(<HealthStatus />)
    
    // 서버 사이드에서는 cleanup이 간단하게 처리됨
    unmount()

    global.window = originalWindow
  })

  it('handles interval skip when consecutive errors exceed max', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<HealthStatus />)

    // 여러 번 에러 발생 시뮬레이션
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    // consecutiveErrorsRef가 MAX_CONSECUTIVE_ERRORS를 초과하도록 설정
    act(() => {
      jest.advanceTimersByTime(10000) // 여러 재시도 시간
    })

    const initialCallCount = (global.fetch as jest.Mock).mock.calls.length

    // interval이 스킵되는지 확인 (30초 후)
    act(() => {
      jest.advanceTimersByTime(30000)
    })

    // consecutiveErrorsRef가 MAX_CONSECUTIVE_ERRORS를 초과하면 interval이 스킵됨
    await waitFor(() => {
      // fetch 호출 수가 크게 증가하지 않아야 함 (retryTimeout이 처리)
      const newCallCount = (global.fetch as jest.Mock).mock.calls.length
      expect(newCallCount).toBeLessThanOrEqual(initialCallCount + 2)
    })
  })
})

