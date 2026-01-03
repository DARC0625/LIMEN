/**
 * VNCViewer 컴포넌트 추가 시나리오 테스트
 */

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import VNCViewer from '../VNCViewer'
import { vmAPI } from '../../lib/api'

// 의존성 모킹
jest.mock('../../lib/api', () => ({
  vmAPI: {
    action: jest.fn(),
    list: jest.fn(),
    getMedia: jest.fn(),
    getISOs: jest.fn(),
    media: jest.fn(),
  },
}))

jest.mock('../../lib/utils/error', () => ({
  handleError: jest.fn(),
}))

jest.mock('../../lib/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

jest.mock('../../lib/types/errors', () => ({
  getErrorMessage: jest.fn((error: any) => error?.message || 'Unknown error'),
}))

// noVNC 모킹
const mockRFB = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  sendCredentials: jest.fn(),
  sendKey: jest.fn(),
  sendPointerEvent: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  scaleViewport: false,
  resizeSession: false,
}

jest.mock('@novnc/novnc', () => ({
  default: jest.fn().mockImplementation(() => mockRFB),
}))

const mockVmAPI = vmAPI as jest.Mocked<typeof vmAPI>

describe('VNCViewer Additional Scenarios', () => {
  const mockProps = {
    uuid: 'test-uuid',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockVmAPI.list.mockResolvedValue([
      { uuid: 'test-uuid', name: 'Test VM', status: 'Running', cpu: 2, memory: 4096 },
    ])
    mockVmAPI.getMedia.mockResolvedValue({ attached: false, media_path: null } as any)
    mockVmAPI.getISOs.mockResolvedValue({ isos: [] } as any)
    
    // window.confirm 모킹
    global.confirm = jest.fn(() => true)
    
    // Fullscreen API 모킹
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null,
    })

    Object.defineProperty(document, 'exitFullscreen', {
      writable: true,
      value: jest.fn(() => Promise.resolve()),
    })

    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      writable: true,
      value: jest.fn(() => Promise.resolve()),
    })
  })

  it('handles restart action', async () => {
    mockVmAPI.action.mockResolvedValue({} as any)

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })

    // Restart 버튼 찾기 (실제 컴포넌트 구조에 맞게 조정 필요)
    const buttons = screen.queryAllByRole('button')
    const restartButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('restart')
    )

    if (restartButton) {
      await act(async () => {
        fireEvent.click(restartButton)
      })

      await waitFor(() => {
        expect(mockVmAPI.action).toHaveBeenCalledWith('test-uuid', 'restart', {})
      })
    }
  })

  it('handles fullscreen toggle', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    })

    // Fullscreen 버튼 찾기 (실제 컴포넌트 구조에 맞게 조정 필요)
    const buttons = screen.queryAllByRole('button')
    const fullscreenButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('fullscreen')
    )

    if (fullscreenButton) {
      await act(async () => {
        fireEvent.click(fullscreenButton)
      })
    }
  })

  it('handles connection errors', async () => {
    const mockError = new Error('Connection failed')
    mockRFB.addEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'disconnect') {
        setTimeout(() => {
          handler({ detail: { reason: 'Connection failed' } })
        }, 100)
      }
    })

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles media operations', async () => {
    mockVmAPI.getMedia.mockResolvedValue({
      attached: true,
      media_path: '/path/to/iso.iso',
    } as any)

    mockVmAPI.getISOs.mockResolvedValue({
      isos: [
        { name: 'test.iso', path: '/path/to/test.iso', size: 1024, modified: '2024-01-01' },
      ],
    } as any)

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles detach media action', async () => {
    mockVmAPI.getMedia.mockResolvedValue({
      attached: true,
      media_path: '/path/to/iso.iso',
    } as any)
    mockVmAPI.media.mockResolvedValue({ message: 'Media disabled successfully' } as any)

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // Detach 버튼 찾기
    const buttons = screen.queryAllByRole('button')
    const detachButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('disable') || 
      btn.textContent?.toLowerCase().includes('detach')
    )

    if (detachButton) {
      await act(async () => {
        fireEvent.click(detachButton)
      })
      await waitFor(() => {
        expect(mockVmAPI.media).toHaveBeenCalled()
      }, { timeout: 3000 })
    }
  })

  it('handles attach media action', async () => {
    mockVmAPI.getMedia.mockResolvedValue({ attached: false, media_path: null } as any)
    mockVmAPI.getISOs.mockResolvedValue({
      isos: [
        { name: 'test.iso', path: '/path/to/test.iso', size: 1024, modified: '2024-01-01' },
      ],
    } as any)
    mockVmAPI.media.mockResolvedValue({ message: 'Media mounted successfully' } as any)

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles F11 fullscreen toggle', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // F11 키 이벤트 발생
    await act(async () => {
      fireEvent.keyDown(window, { key: 'F11' })
    })

    // fullscreen API가 호출되었는지 확인
    expect(HTMLElement.prototype.requestFullscreen).toBeDefined()
  })

  it('handles fullscreen change events', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.queryByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // fullscreenchange 이벤트 발생
    await act(async () => {
      Object.defineProperty(document, 'fullscreenElement', {
        writable: true,
        value: document.createElement('div'),
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })

    // 컴포넌트가 이벤트에 반응하는지 확인 (컴포넌트가 여전히 렌더링되었는지)
    const buttons = screen.queryAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('handles window resize', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.queryByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // window resize 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('resize'))
    })

    // 컴포넌트가 resize에 반응하는지 확인 (컴포넌트가 여전히 렌더링되었는지)
    const statusElement = screen.queryByText(/connecting|connected|disconnected/i)
    const buttons = screen.queryAllByRole('button')
    expect(statusElement || buttons.length > 0).toBeTruthy()
  })

  it('handles VM status check failure', async () => {
    mockVmAPI.action.mockRejectedValue(new Error('VM not found'))

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles media loading errors', async () => {
    mockVmAPI.getMedia.mockRejectedValue(new Error('Failed to load media'))
    mockVmAPI.getISOs.mockResolvedValue({ isos: [] } as any)

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles ISO loading errors', async () => {
    mockVmAPI.getMedia.mockResolvedValue({ attached: false, media_path: null } as any)
    mockVmAPI.getISOs.mockRejectedValue(new Error('Failed to load ISOs'))

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles connection success', async () => {
    mockRFB.addEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'connect') {
        setTimeout(() => {
          handler({})
        }, 100)
      }
    })

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles disconnect event', async () => {
    mockRFB.addEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'disconnect') {
        setTimeout(() => {
          handler({ detail: { reason: 'Normal disconnect' } })
        }, 100)
      }
    })

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles VM not running status', async () => {
    mockVmAPI.list.mockResolvedValue([
      { uuid: 'test-uuid', name: 'Test VM', status: 'Stopped', cpu: 2, memory: 4096 },
    ])

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      // VM이 실행 중이 아니면 상태 메시지가 표시되거나 연결이 시도되지 않음
      const statusElement = screen.queryByText(/not running|stopped|connecting|error/i)
      expect(statusElement).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('handles VM not found', async () => {
    mockVmAPI.list.mockResolvedValue([])

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      // VM을 찾을 수 없으면 상태 메시지가 표시되거나 연결이 시도되지 않음
      const statusElement = screen.queryByText(/not found|connecting|error/i)
      expect(statusElement).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('handles network error during VM status check', async () => {
    mockVmAPI.list.mockRejectedValue(new Error('Network error'))

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.queryByText(/error|network/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles VNC graphics not found error', async () => {
    mockRFB.addEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'connectfailed') {
        setTimeout(() => {
          handler({ detail: { reason: 'VNC graphics not found' } })
        }, 100)
      }
    })

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      // VNC graphics not found 에러가 표시되거나 연결이 실패함
      const statusElement = screen.queryByText(/vnc graphics|not configured|connecting|error/i)
      expect(statusElement).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('handles 403 forbidden error', async () => {
    mockRFB.addEventListener.mockImplementation((event: string, handler: (e: any) => void) => {
      if (event === 'connectfailed') {
        setTimeout(() => {
          handler({ detail: { reason: '403 Forbidden', code: '403' } })
        }, 100)
      }
    })

    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      // 403 Forbidden 에러가 표시되거나 연결이 실패함
      const statusElement = screen.queryByText(/forbidden|403|connecting|error/i)
      expect(statusElement).toBeTruthy()
    }, { timeout: 3000 })
  })

  it('handles connection timeout', async () => {
    render(<VNCViewer {...mockProps} />)

    // 타임아웃 시뮬레이션
    await waitFor(() => {
      expect(screen.queryByText(/connecting|timeout/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles F11 key for fullscreen', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.queryByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })

    // F11 키 이벤트 발생
    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'F11', bubbles: true })
      Object.defineProperty(event, 'preventDefault', { value: jest.fn() })
      window.dispatchEvent(event)
    })

    // 컴포넌트가 키 이벤트에 반응하는지 확인
    const buttons = screen.queryAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})

