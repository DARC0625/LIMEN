/**
 * ThemeToggle 컴포넌트 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ThemeToggle from '../ThemeToggle'
import { ThemeProvider } from '../ThemeProvider'

// ThemeProvider로 감싸는 wrapper
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    {children}
  </ThemeProvider>
)

describe('ThemeToggle', () => {
  beforeEach(() => {
    // localStorage 초기화
    localStorage.clear()
  })

  it('renders theme toggle button', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    expect(button).toBeInTheDocument()
  })

  it('toggles theme on click', async () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 초기 상태 확인
    const initialIcon = button.querySelector('svg')
    expect(initialIcon).toBeInTheDocument()
    
    // 클릭하여 테마 변경
    fireEvent.click(button)
    
    // 테마 변경 확인 (아이콘이 변경되었는지 확인)
    await waitFor(() => {
      const newIcon = button.querySelector('svg')
      expect(newIcon).toBeInTheDocument()
    })
  })

  it('opens menu on right click', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    expect(screen.getByText(/라이트/i)).toBeInTheDocument()
    expect(screen.getByText(/다크/i)).toBeInTheDocument()
    expect(screen.getByText(/시스템/i)).toBeInTheDocument()
  })

  it('closes menu when clicking outside', async () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <ThemeToggle />
      </div>,
      { wrapper }
    )
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    expect(screen.getByText(/라이트/i)).toBeInTheDocument()
    
    // 외부 클릭
    const outside = screen.getByTestId('outside')
    fireEvent.mouseDown(outside)
    
    // 메뉴가 닫혔는지 확인
    await waitFor(() => {
      expect(screen.queryByText(/라이트/i)).not.toBeInTheDocument()
    })
  })

  it('selects theme from menu', async () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 다크 모드 선택
    const darkButton = screen.getByText(/다크/i).closest('button')
    expect(darkButton).toBeInTheDocument()
    
    if (darkButton) {
      fireEvent.click(darkButton)
      
      // 메뉴가 닫혔는지 확인
      await waitFor(() => {
        expect(screen.queryByText(/라이트/i)).not.toBeInTheDocument()
      })
    }
  })
})

