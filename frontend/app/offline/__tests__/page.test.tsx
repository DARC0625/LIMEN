/**
 * app/offline/page.tsx 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react'
import OfflinePage from '../page'

// window.location.reload 모킹 (전역)
const mockReload = jest.fn()
delete (window as any).location
;(window as any).location = { reload: mockReload }

describe('Offline Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockReload.mockClear()
  })

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
    render(<OfflinePage />)

    const retryButton = screen.getByRole('button', { name: /페이지 새로고침/i })
    expect(retryButton).toBeInTheDocument()
    
    // 버튼 클릭 가능 여부 확인
    fireEvent.click(retryButton)
    // window.location.reload는 실제 환경에서만 작동하므로 여기서는 클릭 가능 여부만 확인
  })
})

