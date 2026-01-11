/**
 * app/page.tsx 테스트
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import Home from '../page'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('Home Page', () => {
  const mockRouter = {
    replace: jest.fn(),
    push: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue(mockRouter as any)
    
    // fetch 모킹: 기본적으로 성공 응답 (인증 문제 회피)
    global.fetch = jest.fn((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      
      // waitlist API만 실패하도록 설정 (테스트 목적)
      if (urlString.includes('/api/public/waitlist') || urlString.includes('/api/waitlist')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: '대기자 등록 실패' }),
        } as Response)
      }
      
      // 다른 API들(quota, vms, auth 등)은 성공 응답 (인증 에러 회피)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
        getSetCookie: () => [],
      } as Response)
    })
  })

  it('renders main heading', () => {
    render(<Home />)

    expect(screen.getByText('LIMEN')).toBeInTheDocument()
  })

  it('renders waitlist form section', () => {
    render(<Home />)

    // "대기자 등록" 텍스트가 여러 곳에 있으므로 getAllByText 사용
    const waitlistTexts = screen.getAllByText('대기자 등록')
    expect(waitlistTexts.length).toBeGreaterThan(0)
    
    expect(screen.getByLabelText(/이름/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/소속/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/이메일/i)).toBeInTheDocument()
  })

  it('renders core value sections', () => {
    render(<Home />)

    expect(screen.getByText('웹 기반 접근')).toBeInTheDocument()
    expect(screen.getByText('실시간 환경')).toBeInTheDocument()
    expect(screen.getByText('안전한 격리')).toBeInTheDocument()
  })

  it('handles form submission successfully', async () => {
    // waitlist API만 성공하도록 override
    ;(global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('/api/public/waitlist') || urlString.includes('/api/waitlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          headers: new Headers(),
          getSetCookie: () => [],
        } as Response)
      }
      // 다른 API는 기본 mock 사용
      return (global.fetch as jest.Mock).getMockImplementation()?.(url) || Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
        getSetCookie: () => [],
      } as Response)
    })

    render(<Home />)

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const organizationInput = screen.getByLabelText(/소속/i)
    const submitButton = screen.getByRole('button', { name: /등록하기/i })

    // 폼 입력
    fireEvent.change(nameInput, { target: { value: '홍길동' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(organizationInput, { target: { value: '테스트 조직' } })

    // 제출
    fireEvent.click(submitButton)

    // 성공 메시지 확인 (findByText로 비동기 대기)
    expect(await screen.findByText(/등록.*완료/i)).toBeInTheDocument()

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/public/waitlist'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('handles form submission error', async () => {
      // waitlist API만 실패하도록 override
    ;(global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('/api/public/waitlist') || urlString.includes('/api/waitlist')) {
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: '등록 처리 중 오류가 발생했습니다' }),
          headers: new Headers(),
          getSetCookie: () => [],
        } as Response)
      }
      // 다른 API는 기본 mock 사용 (성공)
      return (global.fetch as jest.Mock).getMockImplementation()?.(url) || Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
        getSetCookie: () => [],
      } as Response)
    })

    render(<Home />)

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const organizationInput = screen.getByLabelText(/소속/i)
    const submitButton = screen.getByRole('button', { name: /등록하기/i })

    fireEvent.change(nameInput, { target: { value: '홍길동' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(organizationInput, { target: { value: '테스트 조직' } })

    fireEvent.click(submitButton)

    // 에러 메시지 확인 (정규식으로 유연하게 매칭)
    // 실제 코드에서는 "등록 처리 중 오류가 발생했습니다" 메시지 사용
    expect(await screen.findByText(/등록.*처리.*오류|등록.*실패/i)).toBeInTheDocument()
  })

  it('handles form submission with purpose field', async () => {
    // waitlist API만 성공하도록 override
    ;(global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('/api/public/waitlist') || urlString.includes('/api/waitlist')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          headers: new Headers(),
          getSetCookie: () => [],
        } as Response)
      }
      // 다른 API는 기본 mock 사용
      return (global.fetch as jest.Mock).getMockImplementation()?.(url) || Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
        getSetCookie: () => [],
      } as Response)
    })

    render(<Home />)

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const organizationInput = screen.getByLabelText(/소속/i)
    const purposeInput = screen.getByLabelText(/사용 목적/i)
    const submitButton = screen.getByRole('button', { name: /등록하기/i })

    fireEvent.change(nameInput, { target: { value: '홍길동' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(organizationInput, { target: { value: '테스트 조직' } })
    fireEvent.change(purposeInput, { target: { value: '보안 실습' } })

    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(fetchCall[1].body)
    expect(body.purpose).toBe('보안 실습')
  })

  it('scrolls to form when button is clicked', () => {
    const mockScrollIntoView = jest.fn()
    const mockGetElementById = jest.fn().mockReturnValue({
      scrollIntoView: mockScrollIntoView,
    })
    document.getElementById = mockGetElementById

    render(<Home />)

    // "대기자 등록" 버튼 찾기 (여러 개가 있을 수 있으므로 role로 찾기)
    const scrollButtons = screen.getAllByText('대기자 등록')
    const scrollButton = scrollButtons.find(btn => btn.tagName === 'BUTTON') || scrollButtons[0]
    fireEvent.click(scrollButton)

    expect(mockGetElementById).toHaveBeenCalledWith('waitlist-form')
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })

  it('disables submit button while submitting', async () => {
    ;(global.fetch as jest.Mock).mockImplementation((url: RequestInfo | URL) => {
      const urlString = typeof url === 'string' ? url : url.toString()
      if (urlString.includes('/api/public/waitlist') || urlString.includes('/api/waitlist')) {
        return new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
          headers: new Headers(),
          getSetCookie: () => [],
        } as Response), 100))
      }
      // 다른 API는 기본 mock 사용
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers(),
        getSetCookie: () => [],
      } as Response)
    })

    render(<Home />)

    const nameInput = screen.getByLabelText(/이름/i)
    const emailInput = screen.getByLabelText(/이메일/i)
    const organizationInput = screen.getByLabelText(/소속/i)
    const submitButton = screen.getByRole('button', { name: /등록하기/i })

    fireEvent.change(nameInput, { target: { value: '홍길동' } })
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.change(organizationInput, { target: { value: '테스트 조직' } })

    fireEvent.click(submitButton)

    // 제출 중에는 버튼이 비활성화되어야 함
    expect(submitButton).toBeDisabled()
    expect(screen.getByText(/등록 중/i)).toBeInTheDocument()
  })

  it('renders footer links', () => {
    render(<Home />)

    expect(screen.getByText(/이용약관/i)).toBeInTheDocument()
    expect(screen.getByText(/개인정보 처리방침/i)).toBeInTheDocument()
    expect(screen.getByText(/서비스 상태/i)).toBeInTheDocument()
  })
})


