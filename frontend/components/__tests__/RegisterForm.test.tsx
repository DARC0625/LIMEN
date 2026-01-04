/**
 * RegisterForm 컴포넌트 테스트
 */

import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import RegisterForm from '../RegisterForm'
import { authAPI } from '../../lib/api'

// 의존성 모킹
const mockPush = jest.fn()
const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}))

jest.mock('../../lib/api', () => ({
  authAPI: {
    register: jest.fn(),
  },
  setToken: jest.fn(),
  setTokens: jest.fn(),
}))

jest.mock('../ToastContainer', () => ({
  useToast: () => mockToast,
}))

describe('RegisterForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders registration form', () => {
    render(<RegisterForm />)
    
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    // password 필드가 여러 개이므로 getAllByLabelText 사용
    const passwordFields = screen.getAllByLabelText(/password/i)
    expect(passwordFields.length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/confirm password|re-enter your password/i)).toBeInTheDocument()
    // 버튼이 있는지 확인 (모든 버튼 중에서 찾기)
    const buttons = screen.getAllByRole('button')
    const createButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )
    expect(createButton).toBeDefined()
  })

  it('handles form submission', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    mockRegister.mockResolvedValue({
      id: 1,
      username: 'testuser',
    } as any)

    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'Test1234!',
      })
    }, { timeout: 3000 })
  })

  it('validates password mismatch', async () => {
    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Different123!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      const errorMessage = screen.queryByText(/비밀번호가 일치하지 않습니다|password.*match|mismatch/i)
      expect(errorMessage).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('validates username format', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    
    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'ab' } }) // 너무 짧은 사용자 이름
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 유효성 검증으로 인해 register가 호출되지 않았는지 확인
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('validates password strength', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    
    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'weak' } }) // 약한 비밀번호
    fireEvent.change(confirmPasswordField, { target: { value: 'weak' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 유효성 검증으로 인해 register가 호출되지 않았는지 확인
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('displays error when registration fails', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    mockRegister.mockRejectedValue(new Error('Registration failed'))

    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })

  it('shows loading state during registration', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    mockRegister.mockImplementation(() => new Promise(() => {})) // 무한 대기

    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // 로딩 상태 확인 (버튼이 비활성화되었는지)
    expect(submitButton).toBeDisabled()
  })

  it('redirects to login after successful registration', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    mockRegister.mockResolvedValue({
      id: 1,
      username: 'testuser',
    } as any)

    jest.useFakeTimers()

    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    }, { timeout: 3000 })

    // 2초 후 리다이렉트
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    }, { timeout: 3000 })

    jest.useRealTimers()
  })

  it('validates empty fields', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    
    render(<RegisterForm />)

    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    await act(async () => {
      fireEvent.click(submitButton)
    })

    // HTML5 validation으로 인해 register가 호출되지 않았는지 확인
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled()
    }, { timeout: 1000 })
  })

  it('handles network errors', async () => {
    const mockRegister = authAPI.register as jest.MockedFunction<typeof authAPI.register>
    mockRegister.mockRejectedValue(new Error('Network error'))

    render(<RegisterForm />)

    const usernameInput = screen.getByLabelText(/username/i)
    const passwordFields = screen.getAllByLabelText(/password/i)
    const confirmPasswordField = screen.getByLabelText(/confirm password|re-enter your password/i)
    const buttons = screen.getAllByRole('button')
    const submitButton = buttons.find(btn => 
      btn.textContent?.toLowerCase().includes('create') || 
      btn.getAttribute('aria-label')?.toLowerCase().includes('create')
    )!

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordFields[0], { target: { value: 'Test1234!' } })
    fireEvent.change(confirmPasswordField, { target: { value: 'Test1234!' } })

    await act(async () => {
      fireEvent.click(submitButton)
    })

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
      expect(mockToast.error).toHaveBeenCalled()
    }, { timeout: 3000 })
  })
})
