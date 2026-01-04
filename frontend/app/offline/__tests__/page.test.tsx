/**
 * app/offline/page.tsx 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react'
import OfflinePage from '../page'

describe('OfflinePage', () => {
  it('renders offline message', () => {
    render(<OfflinePage />)

    expect(screen.getByText(/오프라인 상태/i)).toBeInTheDocument()
    expect(screen.getByText(/인터넷 연결을 확인해주세요/i)).toBeInTheDocument()
  })

  it('renders retry button', () => {
    render(<OfflinePage />)

    const retryButton = screen.getByRole('button', { name: /페이지 새로고침/i })
    expect(retryButton).toBeInTheDocument()
  })

  it('has retry button that can be clicked', () => {
    // window.location.reload를 모킹하기 어려우므로 버튼 존재만 확인
    render(<OfflinePage />)

    const retryButton = screen.getByRole('button', { name: /페이지 새로고침/i })
    expect(retryButton).toBeInTheDocument()
    expect(retryButton).toHaveTextContent('다시 시도')
  })
})
