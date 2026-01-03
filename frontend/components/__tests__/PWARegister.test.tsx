/**
 * PWARegister 컴포넌트 테스트
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import PWARegister from '../PWARegister'

// logger 모킹
jest.mock('../../lib/utils/logger', () => ({
  logger: {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

describe('PWARegister', () => {
  const mockPrompt = jest.fn()
  const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const })

  beforeEach(() => {
    jest.clearAllMocks()
    // matchMedia 모킹
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    // navigator.serviceWorker 모킹
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: jest.fn().mockResolvedValue({
          addEventListener: jest.fn(),
          installing: null,
        }),
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: null,
      },
    })
  })

  it('renders component', () => {
    const { container } = render(<PWARegister />)
    
    // 컴포넌트가 렌더링되는지 확인 (초기에는 설치 버튼이 보이지 않을 수 있음)
    expect(container).toBeInTheDocument()
  })

  it('shows install button when beforeinstallprompt event fires', async () => {
    render(<PWARegister />)

    // beforeinstallprompt 이벤트 생성
    const event = new Event('beforeinstallprompt', { bubbles: true })
    Object.defineProperty(event, 'preventDefault', {
      value: jest.fn(),
      writable: true,
    })
    Object.defineProperty(event, 'prompt', {
      value: mockPrompt,
      writable: true,
    })
    Object.defineProperty(event, 'userChoice', {
      value: mockUserChoice,
      writable: true,
    })

    await act(async () => {
      window.dispatchEvent(event as any)
    })

    await waitFor(() => {
      const installButton = screen.queryByText(/install|설치/i)
      expect(installButton).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('handles install button click', async () => {
    render(<PWARegister />)

    // beforeinstallprompt 이벤트 생성
    const event = new Event('beforeinstallprompt', { bubbles: true })
    Object.defineProperty(event, 'preventDefault', {
      value: jest.fn(),
      writable: true,
    })
    Object.defineProperty(event, 'prompt', {
      value: mockPrompt,
      writable: true,
    })
    Object.defineProperty(event, 'userChoice', {
      value: mockUserChoice,
      writable: true,
    })

    await act(async () => {
      window.dispatchEvent(event as any)
    })

    await waitFor(() => {
      const installButton = screen.queryByText(/install|설치/i)
      expect(installButton).toBeInTheDocument()
    })

    const installButton = screen.getByText(/install|설치/i)
    await act(async () => {
      fireEvent.click(installButton)
    })

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled()
    })
  })

  it('does not show install button when already installed', () => {
    // standalone 모드 모킹 (이미 설치됨)
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    render(<PWARegister />)

    // 설치 버튼이 표시되지 않아야 함
    const installButton = screen.queryByText(/install|설치/i)
    expect(installButton).not.toBeInTheDocument()
  })
})
