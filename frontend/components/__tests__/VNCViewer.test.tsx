/**
 * VNCViewer 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
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
jest.mock('@novnc/novnc', () => ({
  default: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    sendCredentials: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  })),
}))

const mockVmAPI = vmAPI as jest.Mocked<typeof vmAPI>

describe('VNCViewer', () => {
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
  })

  it('renders VNC viewer', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('displays status message', async () => {
    render(<VNCViewer {...mockProps} />)

    await waitFor(() => {
      const statusElement = screen.queryByText(/connecting/i)
      expect(statusElement).toBeInTheDocument()
    }, { timeout: 3000 })
  })
})





