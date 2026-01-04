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

  it('handles user dismissing install prompt', async () => {
    const dismissedChoice = Promise.resolve({ outcome: 'dismissed' as const })
    
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
      value: dismissedChoice,
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
      await dismissedChoice
    })

    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled()
    })

    // 버튼이 사라져야 함
    await waitFor(() => {
      const button = screen.queryByText(/install|설치/i)
      expect(button).not.toBeInTheDocument()
    })
  })

  it('handles install click when deferredPrompt is null - button not rendered', async () => {
    render(<PWARegister />)

    // deferredPrompt가 null이면 showInstallButton도 false이므로
    // 버튼이 렌더링되지 않습니다
    // 따라서 handleInstallClick이 호출될 수 없습니다
    const installButton = screen.queryByText(/install|설치/i)
    expect(installButton).not.toBeInTheDocument()
    
    // 77번 라인의 브랜치는 실제로는 실행되지 않을 수 있지만,
    // 코드의 방어적 프로그래밍을 위한 것입니다
  })

  it('registers service worker in production', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockRegistration = {
      addEventListener: jest.fn(),
      installing: null,
    }
    const mockRegister = jest.fn().mockResolvedValue(mockRegistration)
    
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: mockRegister,
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: null,
      },
    })

    render(<PWARegister />)

    // window load 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('load'))
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' })
    }, { timeout: 3000 })

    process.env.NODE_ENV = originalEnv
  })

  it('handles service worker update found', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockNewWorker = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'statechange') {
          // statechange 이벤트 시뮬레이션
          setTimeout(() => {
            handler()
          }, 100)
        }
      }),
      state: 'installed',
    }

    const mockRegistration = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'updatefound') {
          // updatefound 이벤트 시뮬레이션
          setTimeout(() => {
            handler()
          }, 100)
        }
      }),
      installing: mockNewWorker,
    }

    const mockRegister = jest.fn().mockResolvedValue(mockRegistration)
    
    // window.confirm 모킹
    global.confirm = jest.fn(() => false) // 새로고침 취소
    
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: mockRegister,
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: { postMessage: jest.fn() }, // controller가 있으면 업데이트 알림
      },
    })

    render(<PWARegister />)

    // window load 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('load'))
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    }, { timeout: 3000 })

    // updatefound 이벤트가 등록되었는지 확인
    await waitFor(() => {
      expect(mockRegistration.addEventListener).toHaveBeenCalledWith('updatefound', expect.any(Function))
    }, { timeout: 3000 })

    process.env.NODE_ENV = originalEnv
  })

  it('handles service worker registration error', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockRegister = jest.fn().mockRejectedValue(new Error('Registration failed'))
    
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: mockRegister,
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: null,
      },
    })

    const { logger } = require('../../lib/utils/logger')

    render(<PWARegister />)

    // window load 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('load'))
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    }, { timeout: 3000 })

    // 에러가 로그에 기록되었는지 확인
    await waitFor(() => {
      expect(logger.warn).toHaveBeenCalled()
    }, { timeout: 3000 })

    process.env.NODE_ENV = originalEnv
  })

  it('unregisters service worker in development', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    const mockUnregister = jest.fn().mockResolvedValue(true)
    const mockRegistration = {
      unregister: mockUnregister,
    }
    const mockGetRegistrations = jest.fn().mockResolvedValue([mockRegistration])
    
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: jest.fn(),
        getRegistrations: mockGetRegistrations,
        controller: null,
      },
    })

    render(<PWARegister />)

    await waitFor(() => {
      expect(mockGetRegistrations).toHaveBeenCalled()
    }, { timeout: 3000 })

    await waitFor(() => {
      expect(mockUnregister).toHaveBeenCalled()
    }, { timeout: 3000 })

    process.env.NODE_ENV = originalEnv
  })

  it('handles service worker statechange to installed with controller', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockConfirm = jest.fn(() => true)
    global.confirm = mockConfirm

    const mockNewWorker = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'statechange') {
          // statechange 이벤트 시뮬레이션 - installed 상태
          setTimeout(() => {
            Object.defineProperty(mockNewWorker, 'state', {
              value: 'installed',
              writable: true,
            })
            handler()
          }, 100)
        }
      }),
      state: 'installing',
    }

    const mockRegistration = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'updatefound') {
          setTimeout(() => {
            handler()
          }, 100)
        }
      }),
      installing: mockNewWorker,
    }

    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: jest.fn().mockResolvedValue(mockRegistration),
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: {}, // controller가 있음 (이미 설치된 경우)
      },
    })

    render(<PWARegister />)

    // window load 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('load'))
    })

    // statechange 이벤트 처리 대기
    await waitFor(() => {
      expect(mockNewWorker.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function))
    }, { timeout: 3000 })

    // statechange 이벤트 발생
    await act(async () => {
      const statechangeHandler = mockNewWorker.addEventListener.mock.calls.find(
        call => call[0] === 'statechange'
      )?.[1]
      if (statechangeHandler) {
        statechangeHandler()
      }
    })

    // confirm이 호출되었는지 확인 (새 버전이 설치된 경우)
    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalled()
    }, { timeout: 3000 })

    process.env.NODE_ENV = originalEnv
  })

  it('handles service worker statechange to installed without controller', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const mockNewWorker = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'statechange') {
          setTimeout(() => {
            Object.defineProperty(mockNewWorker, 'state', {
              value: 'installed',
              writable: true,
            })
            handler()
          }, 100)
        }
      }),
      state: 'installing',
    }

    const mockRegistration = {
      addEventListener: jest.fn((event, handler) => {
        if (event === 'updatefound') {
          setTimeout(() => {
            handler()
          }, 100)
        }
      }),
      installing: mockNewWorker,
    }

    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      value: {
        register: jest.fn().mockResolvedValue(mockRegistration),
        getRegistrations: jest.fn().mockResolvedValue([]),
        controller: null, // controller가 없음 (첫 설치)
      },
    })

    render(<PWARegister />)

    // window load 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('load'))
    })

    // statechange 이벤트 처리 대기
    await waitFor(() => {
      expect(mockNewWorker.addEventListener).toHaveBeenCalledWith('statechange', expect.any(Function))
    }, { timeout: 3000 })

    // statechange 이벤트 발생
    await act(async () => {
      const statechangeHandler = mockNewWorker.addEventListener.mock.calls.find(
        call => call[0] === 'statechange'
      )?.[1]
      if (statechangeHandler) {
        statechangeHandler()
      }
    })

    // controller가 없으면 confirm이 호출되지 않아야 함
    expect(global.confirm).not.toHaveBeenCalled()

    process.env.NODE_ENV = originalEnv
  })

  it('handles install click when deferredPrompt is null', async () => {
    render(<PWARegister />)

    // deferredPrompt가 null인 상태에서 설치 버튼 클릭 시뮬레이션
    // (showInstallButton이 false이므로 버튼이 렌더링되지 않음)
    const installButton = screen.queryByText(/설치/i)
    expect(installButton).not.toBeInTheDocument()
  })

  it('handles install prompt user choice accepted', async () => {
    const mockPrompt = jest.fn()
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const })
    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    }

    Object.defineProperty(window, 'beforeinstallprompt', {
      writable: true,
      value: mockEvent,
    })

    render(<PWARegister />)

    // beforeinstallprompt 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    // 설치 버튼이 나타났는지 확인
    await waitFor(() => {
      const installButton = screen.queryByText(/설치/i)
      expect(installButton).toBeInTheDocument()
    }, { timeout: 3000 })

    // 설치 버튼 클릭
    const installButton = screen.getByText(/설치/i)
    await act(async () => {
      fireEvent.click(installButton)
    })

    // prompt가 호출되었는지 확인
    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('handles install prompt user choice dismissed', async () => {
    const mockPrompt = jest.fn()
    const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const })
    const mockEvent = {
      preventDefault: jest.fn(),
      prompt: mockPrompt,
      userChoice: mockUserChoice,
    }

    Object.defineProperty(window, 'beforeinstallprompt', {
      writable: true,
      value: mockEvent,
    })

    render(<PWARegister />)

    // beforeinstallprompt 이벤트 발생
    await act(async () => {
      window.dispatchEvent(new Event('beforeinstallprompt'))
    })

    // 설치 버튼이 나타났는지 확인
    await waitFor(() => {
      const installButton = screen.queryByText(/설치/i)
      expect(installButton).toBeInTheDocument()
    }, { timeout: 3000 })

    // 설치 버튼 클릭
    const installButton = screen.getByText(/설치/i)
    await act(async () => {
      fireEvent.click(installButton)
    })

    // prompt가 호출되었는지 확인
    await waitFor(() => {
      expect(mockPrompt).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})
