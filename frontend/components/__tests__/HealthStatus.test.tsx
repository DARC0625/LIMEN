/**
 * HealthStatus 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
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
})

