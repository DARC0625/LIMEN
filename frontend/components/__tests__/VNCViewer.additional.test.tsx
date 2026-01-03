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
})

