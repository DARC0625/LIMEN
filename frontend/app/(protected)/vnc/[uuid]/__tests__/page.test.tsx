/**
 * app/(protected)/vnc/[uuid]/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useParams } from 'next/navigation'
import VNCPage from '../page'
import VNCViewer from '../../../../components/VNCViewer'

// 의존성 모킹
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
}))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => ({ uuid }: { uuid: string }) => <div>VNCViewer: {uuid}</div>,
}))

jest.mock('@/components/VNCViewer', () => ({
  __esModule: true,
  default: ({ uuid }: { uuid: string }) => <div>VNCViewer: {uuid}</div>,
}))

const mockUseParams = useParams as jest.MockedFunction<typeof useParams>

describe('VNC Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders VNC viewer with uuid from params', () => {
    mockUseParams.mockReturnValue({ uuid: 'test-uuid' } as any)

    render(<VNCPage />)

    expect(screen.getByText(/VNCViewer: test-uuid/i)).toBeInTheDocument()
  })

  it('handles missing uuid parameter', () => {
    mockUseParams.mockReturnValue({} as any)

    render(<VNCPage />)

    // uuid가 없으면 Invalid VM UUID 메시지 표시
    expect(screen.getByText(/Invalid VM UUID/i)).toBeInTheDocument()
  })
})

