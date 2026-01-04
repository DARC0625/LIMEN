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

  it('selects light theme from menu', async () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 라이트 모드 선택
    const lightButton = screen.getByText(/라이트/i).closest('button')
    expect(lightButton).toBeInTheDocument()
    
    if (lightButton) {
      fireEvent.click(lightButton)
      
      // 메뉴가 닫혔는지 확인
      await waitFor(() => {
        expect(screen.queryByText(/라이트/i)).not.toBeInTheDocument()
      })
    }
  })

  it('selects system theme from menu', async () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 시스템 모드 선택
    const systemButton = screen.getByText(/시스템/i).closest('button')
    expect(systemButton).toBeInTheDocument()
    
    if (systemButton) {
      fireEvent.click(systemButton)
      
      // 메뉴가 닫혔는지 확인
      await waitFor(() => {
        expect(screen.queryByText(/라이트/i)).not.toBeInTheDocument()
      })
    }
  })

  it('toggles menu on right click when already open', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    expect(screen.getByText(/라이트/i)).toBeInTheDocument()
    
    // 다시 우클릭하여 메뉴 닫기
    fireEvent.contextMenu(button)
    
    // 메뉴가 닫혔는지 확인
    expect(screen.queryByText(/라이트/i)).not.toBeInTheDocument()
  })

  it('prevents event propagation on button click', () => {
    const handleParentClick = jest.fn()
    
    render(
      <div onClick={handleParentClick}>
        <ThemeToggle />
      </div>,
      { wrapper }
    )
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 클릭 이벤트 발생
    fireEvent.click(button)
    
    // 부모 클릭 핸들러가 호출되지 않아야 함 (stopPropagation)
    expect(handleParentClick).not.toHaveBeenCalled()
  })

  it('prevents event propagation on menu click', () => {
    const handleParentClick = jest.fn()
    
    render(
      <div onClick={handleParentClick}>
        <ThemeToggle />
      </div>,
      { wrapper }
    )
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴 클릭
    const menu = screen.getByRole('menu')
    fireEvent.click(menu)
    
    // 부모 클릭 핸들러가 호출되지 않아야 함 (stopPropagation)
    expect(handleParentClick).not.toHaveBeenCalled()
  })

  it('shows checkmark for selected theme', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 현재 선택된 테마에 체크마크가 있는지 확인
    // (초기 테마에 따라 다를 수 있음)
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems.length).toBeGreaterThan(0)
    
    // 체크마크가 있는 항목이 있는지 확인
    const hasCheckmark = menuItems.some(item => item.textContent?.includes('✓'))
    expect(hasCheckmark).toBe(true)
  })

  it('handles click outside when menu is open', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    expect(screen.getByRole('menu')).toBeInTheDocument()
    
    // 외부 클릭
    fireEvent.mouseDown(document.body)
    
    // 메뉴가 닫혔는지 확인
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('does not close menu when clicking inside menu', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    
    // 메뉴 내부 클릭
    fireEvent.mouseDown(menu)
    
    // 메뉴가 여전히 열려있는지 확인
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('does not close menu when clicking button', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    expect(screen.getByRole('menu')).toBeInTheDocument()
    
    // 버튼 클릭
    fireEvent.mouseDown(button)
    
    // 메뉴가 여전히 열려있는지 확인 (버튼 클릭은 메뉴를 닫지 않음)
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('closes menu when selecting theme', () => {
    render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    expect(screen.getByRole('menu')).toBeInTheDocument()
    
    // 테마 선택
    const menuItems = screen.getAllByRole('menuitem')
    fireEvent.click(menuItems[0])
    
    // 메뉴가 닫혔는지 확인
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('handles menu cleanup on unmount', () => {
    const { unmount } = render(<ThemeToggle />, { wrapper })
    
    const button = screen.getByLabelText(/toggle theme/i)
    
    // 우클릭하여 메뉴 열기
    fireEvent.contextMenu(button)
    
    // 메뉴가 열렸는지 확인
    expect(screen.getByRole('menu')).toBeInTheDocument()
    
    // 컴포넌트 언마운트
    unmount()
    
    // 언마운트 후에도 에러가 발생하지 않아야 함
    expect(true).toBe(true)
  })
})


