/**
 * app/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
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
  })

  it('renders redirect message', () => {
    render(<Home />)

    expect(screen.getByText(/리다이렉트 중/i)).toBeInTheDocument()
  })

  it('redirects to login page', async () => {
    render(<Home />)

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith('/login')
    })
  })
})

