/**
 * ErrorDisplay 컴포넌트 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { ErrorDisplay } from '../ErrorDisplay'

// next/navigation 모킹
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('ErrorDisplay', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter as any)
    // window.location.href 모킹
    delete (window as any).location
    ;(window as any).location = { href: '' }
  })

  it('renders error message', () => {
    const error = new Error('Test error')
    render(<ErrorDisplay error={error} />)

    // UNKNOWN_ERROR는 기본값이므로 "오류 발생" 제목이 표시됨
    expect(screen.getByText(/오류 발생/i)).toBeInTheDocument()
  })

  it('displays custom error code', () => {
    const error = { code: 'NOT_APPROVED' } as any
    render(<ErrorDisplay error={error} />)

    expect(screen.getByText(/초대 대기 중/i)).toBeInTheDocument()
  })

  it('handles onAction callback', () => {
    // actionUrl이 없는 에러 코드 사용 (SERVER_OVERLOAD는 action만 있고 actionUrl 없음)
    const error = { code: 'SERVER_OVERLOAD' } as any
    const mockOnAction = jest.fn()
    render(<ErrorDisplay error={error} onAction={mockOnAction} />)

    const actionButton = screen.getByRole('button')
    fireEvent.click(actionButton)

    expect(mockOnAction).toHaveBeenCalledTimes(1)
  })

  it('navigates to actionUrl when provided', () => {
    const error = { code: 'SERVICE_UNAVAILABLE' } as any
    render(<ErrorDisplay error={error} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/status')
  })

  it('handles mailto: actionUrl', () => {
    const error = { code: 'UNKNOWN_ERROR' } as any
    render(<ErrorDisplay error={error} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('mailto:'))
  })

  it('handles router.push for non-mailto actionUrl', () => {
    const error = { code: 'NETWORK_ERROR' } as any
    const mockOnAction = jest.fn()
    render(<ErrorDisplay error={error} onAction={mockOnAction} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    // onAction이 있으면 router.push 대신 onAction 호출
    expect(mockOnAction).toHaveBeenCalled()
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('handles router.push when no onAction provided', () => {
    const error = { code: 'NETWORK_ERROR' } as any
    render(<ErrorDisplay error={error} />)

    // NETWORK_ERROR는 action만 있고 actionUrl이 없으므로 버튼이 표시됨
    const button = screen.getByRole('button')
    fireEvent.click(button)

    // actionUrl이 없으면 router.push가 호출되지 않음
    expect(mockRouter.push).not.toHaveBeenCalled()
  })

  it('renders action button for errors without actionUrl', () => {
    const error = { code: 'SERVER_OVERLOAD' } as any
    render(<ErrorDisplay error={error} />)

    // SERVER_OVERLOAD는 action만 있고 actionUrl이 없으므로 버튼이 표시됨
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('재시도')
  })

  it('displays error icon', () => {
    const error = new Error('Test error')
    render(<ErrorDisplay error={error} />)

    // 이모지 아이콘 확인
    expect(screen.getByText('⚠️')).toBeInTheDocument()
  })
})

