/**
 * app/terms/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import TermsPage from '../page'

describe('TermsPage', () => {
  it('renders terms title', () => {
    render(<TermsPage />)

    expect(screen.getByText('이용약관')).toBeInTheDocument()
  })

  it('renders terms sections', () => {
    render(<TermsPage />)

    expect(screen.getByText(/제1조.*목적/i)).toBeInTheDocument()
    expect(screen.getByText(/제2조.*정의/i)).toBeInTheDocument()
    expect(screen.getByText(/제3조.*서비스의 제공/i)).toBeInTheDocument()
  })

  it('renders home link', () => {
    render(<TermsPage />)

    const homeLink = screen.getByText(/홈으로 돌아가기/i)
    expect(homeLink).toBeInTheDocument()
    expect(homeLink.closest('a')).toHaveAttribute('href', '/')
  })
})


