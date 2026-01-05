/**
 * app/privacy/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import PrivacyPage from '../page'

describe('PrivacyPage', () => {
  it('renders privacy title', () => {
    render(<PrivacyPage />)

    expect(screen.getByText('개인정보 처리방침')).toBeInTheDocument()
  })

  it('renders privacy sections', () => {
    render(<PrivacyPage />)

    expect(screen.getByText(/제1조.*개인정보의 처리 목적/i)).toBeInTheDocument()
    expect(screen.getByText(/제2조.*처리하는 개인정보의 항목/i)).toBeInTheDocument()
    expect(screen.getByText(/제3조.*개인정보의 처리 및 보유 기간/i)).toBeInTheDocument()
  })

  it('renders home link', () => {
    render(<PrivacyPage />)

    const homeLink = screen.getByText(/홈으로 돌아가기/i)
    expect(homeLink).toBeInTheDocument()
    expect(homeLink.closest('a')).toHaveAttribute('href', '/')
  })
})


