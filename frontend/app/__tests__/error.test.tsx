/**
 * app/error.tsx 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react'
import ErrorPage from '../error'

describe('Error Page', () => {
  const mockReset = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders error message', () => {
    render(<ErrorPage error={new Error('Test error')} reset={mockReset} />)

    expect(screen.getByRole('heading', { name: /오류가 발생했습니다/i })).toBeInTheDocument()
  })

  it('calls reset when retry button is clicked', () => {
    render(<ErrorPage error={new Error('Test error')} reset={mockReset} />)

    const retryButton = screen.getByRole('button', { name: /다시 시도/i })
    fireEvent.click(retryButton)

    expect(mockReset).toHaveBeenCalled()
  })

  it('renders login page button', () => {
    render(<ErrorPage error={new Error('Test error')} reset={mockReset} />)

    expect(screen.getByRole('button', { name: /로그인 페이지로 이동/i })).toBeInTheDocument()
  })
})

