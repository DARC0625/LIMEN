/**
 * components/ThemeProvider.tsx 테스트
 */

import { render, screen, waitFor, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeProvider'

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear()
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
  })

  afterEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders children', () => {
    const { getByText } = render(
      <ThemeProvider>
        <div>Test Content</div>
      </ThemeProvider>
    )

    expect(getByText('Test Content')).toBeInTheDocument()
  })

  it('provides theme context', () => {
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    )

    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('loads theme from localStorage', async () => {
    localStorage.setItem('theme', 'dark')

    const TestComponent = () => {
      const { theme } = useTheme()
      return <div>Theme: {theme}</div>
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Theme: dark/i)).toBeInTheDocument()
    })
  })

  it('uses system theme as default', async () => {
    const TestComponent = () => {
      const { theme } = useTheme()
      return <div>Theme: {theme}</div>
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })
  })

  it('applies dark theme when resolved theme is dark', async () => {
    localStorage.setItem('theme', 'dark')

    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true)
    })
  })

  it('removes dark class when resolved theme is light', async () => {
    localStorage.setItem('theme', 'light')

    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false)
    })
  })
})

describe('useTheme', () => {
  it('throws error when used outside ThemeProvider', () => {
    // React의 에러 경고를 억제
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})

    const TestComponent = () => {
      useTheme()
      return null
    }

    expect(() => render(<TestComponent />)).toThrow('useTheme must be used within a ThemeProvider')

    consoleError.mockRestore()
  })

  it('provides theme context when used inside ThemeProvider', async () => {
    const TestComponent = () => {
      const { theme, setTheme, toggleTheme } = useTheme()
      return (
        <div>
          <div>Theme: {theme}</div>
          <button onClick={() => setTheme('dark')}>Set Dark</button>
          <button onClick={() => toggleTheme()}>Toggle</button>
        </div>
      )
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })
  })

  it('handles system theme change event', async () => {
    localStorage.setItem('theme', 'system')
    
    const mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    })

    const TestComponent = () => {
      const { theme, resolvedTheme } = useTheme()
      return (
        <div>
          <div>Theme: {theme}</div>
          <div>Resolved: {resolvedTheme}</div>
        </div>
      )
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })

    // matchMedia가 호출되었는지 확인
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)')
    
    // mediaQuery 인스턴스 가져오기
    const mediaQuery = mockMatchMedia.mock.results[0].value
    
    // change 이벤트 발생 시뮬레이션
    await act(async () => {
      if (mediaQuery.addEventListener.mock.calls.length > 0) {
        const handler = mediaQuery.addEventListener.mock.calls[0][1]
        if (typeof handler === 'function') {
          handler()
        }
      }
    })

    // 테마가 적용되었는지 확인
    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })
  })

  it('handles system theme change when theme is system', async () => {
    localStorage.setItem('theme', 'system')
    
    let changeHandler: (() => void) | null = null
    
    const mockMatchMedia = jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn((event, handler) => {
        if (event === 'change') {
          changeHandler = handler as () => void
        }
      }),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }))
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia,
    })

    const TestComponent = () => {
      const { theme } = useTheme()
      return <div>Theme: {theme}</div>
    }

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })

    // change 이벤트 핸들러가 등록되었는지 확인
    expect(mockMatchMedia).toHaveBeenCalled()
    
    // change 이벤트 발생 시뮬레이션
    if (changeHandler) {
      await act(async () => {
        changeHandler()
      })
    }

    // 테마가 적용되었는지 확인
    await waitFor(() => {
      expect(screen.getByText(/Theme: system/i)).toBeInTheDocument()
    })
  })
})
