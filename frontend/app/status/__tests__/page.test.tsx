/**
 * app/status/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import StatusPage from '../page'

// VersionInfo 모킹
jest.mock('@/components/VersionInfo', () => ({
  VersionInfo: () => <div>Version Info</div>,
}))

describe('StatusPage', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('shows loading state initially', () => {
    ;(global.fetch as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // 무한 대기
    )

    render(<StatusPage />)

    expect(screen.getByText(/상태 확인 중/i)).toBeInTheDocument()
  })

  it('displays operational status', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'operational',
        message: '모든 시스템이 정상 작동 중입니다.',
      }),
    })

    render(<StatusPage />)

    await waitFor(() => {
      // "정상" 텍스트가 여러 곳에 있으므로 getAllByText 사용
      expect(screen.getByText(/시스템 상태/i)).toBeInTheDocument()
      const normalElements = screen.getAllByText(/정상/i)
      expect(normalElements.length).toBeGreaterThan(0)
    })

    expect(screen.getByText(/모든 시스템이 정상 작동 중입니다/i)).toBeInTheDocument()
  })

  it('displays degraded status', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getByText(/부분 장애/i)).toBeInTheDocument()
    })
  })

  it('displays outage status on fetch error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getByText(/장애/i)).toBeInTheDocument()
    })

    expect(screen.getByText(/서비스 상태를 확인할 수 없습니다/i)).toBeInTheDocument()
  })

  it('renders service components', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'operational',
        message: '모든 시스템이 정상 작동 중입니다.',
      }),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getByText(/API 서버/i)).toBeInTheDocument()
      expect(screen.getByText(/데이터베이스/i)).toBeInTheDocument()
      expect(screen.getByText(/VM 관리 시스템/i)).toBeInTheDocument()
      expect(screen.getByText(/VNC 콘솔/i)).toBeInTheDocument()
    })
  })

  it('renders VersionInfo', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'operational',
        message: '모든 시스템이 정상 작동 중입니다.',
      }),
    })

    render(<StatusPage />)

    await waitFor(() => {
      expect(screen.getByText('Version Info')).toBeInTheDocument()
    })
  })
})

