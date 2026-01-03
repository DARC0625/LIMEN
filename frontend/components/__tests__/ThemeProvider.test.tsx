/**
 * ThemeProvider 컴포넌트 테스트
 */

import { render, screen, act } from '@testing-library/react'
import { ThemeProvider, useTheme } from '../ThemeProvider'

// ThemeProvider로 감싸는 테스트 컴포넌트
const TestComponent = () => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()
  
  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('system')}>Set System</button>
      <button onClick={toggleTheme}>Toggle Theme</button>
    </div>
  )
}

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
  })

  it('provides theme context', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    expect(screen.getByTestId('theme')).toBeInTheDocument()
    expect(screen.getByTestId('resolved-theme')).toBeInTheDocument()
  })

  it('sets theme to light', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    const button = screen.getByText('Set Light')
    act(() => {
      button.click()
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('sets theme to dark', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    const button = screen.getByText('Set Dark')
    act(() => {
      button.click()
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
  })

  it('sets theme to system', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    const button = screen.getByText('Set System')
    act(() => {
      button.click()
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    expect(screen.getByTestId('theme')).toHaveTextContent('system')
    expect(localStorage.getItem('theme')).toBe('system')
  })

  it('toggles theme', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    // 먼저 light로 설정
    const setLightButton = screen.getByText('Set Light')
    act(() => {
      setLightButton.click()
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    // 토글
    const toggleButton = screen.getByText('Toggle Theme')
    act(() => {
      toggleButton.click()
    })
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    
    // dark로 변경되었는지 확인
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it('loads theme from localStorage', async () => {
    localStorage.setItem('theme', 'dark')
    
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )
    
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100))
    })
    
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })

  it('throws error when useTheme is used outside provider', () => {
    // 에러를 캐치하기 위해 console.error를 모킹
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    const TestComponentWithoutProvider = () => {
      useTheme()
      return <div>Test</div>
    }
    
    expect(() => {
      render(<TestComponentWithoutProvider />)
    }).toThrow('useTheme must be used within a ThemeProvider')
    
    consoleError.mockRestore()
  })
})

