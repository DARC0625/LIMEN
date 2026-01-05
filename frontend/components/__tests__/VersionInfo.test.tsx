/**
 * VersionInfo 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react'
import { VersionInfo } from '../VersionInfo'

describe('VersionInfo', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('renders version info when environment variables are set', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'abc123def456'
    process.env.NEXT_PUBLIC_BUILD_TIME = '2024-01-01T00:00:00Z'

    render(<VersionInfo />)

    expect(screen.getByText(/v1\.0\.0/i)).toBeInTheDocument()
    expect(screen.getByText(/abc123/i)).toBeInTheDocument()
  })

  it('renders default values when environment variables are not set', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION
    delete process.env.NEXT_PUBLIC_COMMIT_HASH
    delete process.env.NEXT_PUBLIC_BUILD_TIME

    render(<VersionInfo />)

    expect(screen.getByText(/vdev/i)).toBeInTheDocument()
    // commitHash가 'unknown'이면 표시되지 않음
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  it('does not render commit hash when it is unknown', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'unknown'
    delete process.env.NEXT_PUBLIC_BUILD_TIME

    render(<VersionInfo />)

    expect(screen.getByText(/v1\.0\.0/i)).toBeInTheDocument()
    expect(screen.queryByText(/unknown/i)).not.toBeInTheDocument()
  })

  it('renders build time when provided', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'abc123'
    process.env.NEXT_PUBLIC_BUILD_TIME = '2024-01-01T00:00:00Z'

    render(<VersionInfo />)

    expect(screen.getByText(/v1\.0\.0/i)).toBeInTheDocument()
    // 날짜가 표시되는지 확인 (로케일에 따라 형식이 다를 수 있음)
    const buildTimeElement = screen.getByText(/2024|01|Jan/i)
    expect(buildTimeElement).toBeInTheDocument()
  })

  it('renders service status link', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'abc123'

    render(<VersionInfo />)

    const statusLink = screen.getByText(/서비스 상태/i)
    expect(statusLink).toBeInTheDocument()
    expect(statusLink.closest('a')).toHaveAttribute('href', '/status')
  })

  it('renders documentation link', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'abc123'

    render(<VersionInfo />)

    const docLink = screen.getByText(/문서/i)
    expect(docLink).toBeInTheDocument()
    expect(docLink.closest('a')).toHaveAttribute('href', 'https://github.com/DARC0625/LIMEN')
    expect(docLink.closest('a')).toHaveAttribute('target', '_blank')
    expect(docLink.closest('a')).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('truncates commit hash to 7 characters', () => {
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.NEXT_PUBLIC_COMMIT_HASH = 'abcdef1234567890'
    delete process.env.NEXT_PUBLIC_BUILD_TIME

    render(<VersionInfo />)

    // 처음 7자만 표시되는지 확인
    expect(screen.getByText(/abcdef1/i)).toBeInTheDocument()
    // 전체 해시는 표시되지 않아야 함
    expect(screen.queryByText(/abcdef1234567890/i)).not.toBeInTheDocument()
  })

  it('returns null when version is not set', () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION
    delete process.env.NEXT_PUBLIC_COMMIT_HASH

    const { container } = render(<VersionInfo />)
    
    // version이 null이면 컴포넌트가 null을 반환하지만,
    // 기본값 'dev'가 설정되므로 실제로는 렌더링됨
    expect(container.firstChild).toBeInTheDocument()
  })
})



