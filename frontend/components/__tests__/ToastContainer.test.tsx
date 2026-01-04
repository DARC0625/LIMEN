/**
 * ToastContainer 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { ToastProvider, useToast } from '../ToastContainer'
import { act } from 'react'

// ToastProvider로 감싸는 테스트 컴포넌트
const TestComponent = () => {
  const toast = useToast()
  
  return (
    <div>
      <button onClick={() => toast.success('Success message')}>Show Success</button>
      <button onClick={() => toast.error('Error message')}>Show Error</button>
      <button onClick={() => toast.info('Info message')}>Show Info</button>
      <button onClick={() => toast.warning('Warning message')}>Show Warning</button>
      <button onClick={() => toast.showToast('Custom message', 'success', 1000)}>Show Custom</button>
    </div>
  )
}

describe('ToastContainer', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('provides toast context', () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    expect(screen.getByText('Show Success')).toBeInTheDocument()
    expect(screen.getByText('Show Error')).toBeInTheDocument()
  })

  it('shows success toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Success')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument()
    })
  })

  it('shows error toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Error')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })
  })

  it('shows info toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Info')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Info message')).toBeInTheDocument()
    })
  })

  it('shows warning toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Warning')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Warning message')).toBeInTheDocument()
    })
  })

  it('shows custom toast', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Custom')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Custom message')).toBeInTheDocument()
    })
  })

  it('throws error when useToast is used outside provider', () => {
    // 에러를 캐치하기 위해 console.error를 모킹
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    expect(() => {
      render(<TestComponent />)
    }).toThrow('useToast must be used within ToastProvider')
    
    consoleError.mockRestore()
  })

  it('removes toast when closed', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Success')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument()
    })
    
    const closeButton = screen.getByLabelText(/close.*notification/i)
    act(() => {
      closeButton.click()
    })
    
    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })
  })

  it('shows multiple toasts', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const successButton = screen.getByText('Show Success')
    const errorButton = screen.getByText('Show Error')
    
    act(() => {
      successButton.click()
      errorButton.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })
  })

  it('handles custom duration', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    )
    
    const button = screen.getByText('Show Custom')
    act(() => {
      button.click()
    })
    
    await waitFor(() => {
      expect(screen.getByText('Custom message')).toBeInTheDocument()
    })
    
    // 커스텀 duration(1000ms) 후 자동으로 닫히는지 확인
    act(() => {
      jest.advanceTimersByTime(1000)
    })
    
    await waitFor(() => {
      expect(screen.queryByText('Custom message')).not.toBeInTheDocument()
    })
  })
})


