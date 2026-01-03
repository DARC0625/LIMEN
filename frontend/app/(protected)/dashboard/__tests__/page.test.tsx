/**
 * app/(protected)/dashboard/page.tsx 테스트
 */

import { render, screen, waitFor } from '@testing-library/react'
import { useAuth } from '../../../../components/AuthGuard'
import { useToast } from '../../../../components/ToastContainer'
import { useCreateVM, useVMAction } from '../../../../hooks/useVMs'
import { isAdmin } from '../../../../lib/api'
import DashboardPage from '../page'

// 의존성 모킹
jest.mock('../../../../components/AuthGuard', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../../../../components/ToastContainer', () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  }),
}))

jest.mock('../../../../hooks/useVMs', () => ({
  useCreateVM: jest.fn(),
  useVMAction: jest.fn(),
}))

jest.mock('../../../../lib/api', () => ({
  isAdmin: jest.fn(),
  removeToken: jest.fn(),
}))

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (loader: () => Promise<any>) => {
    const Component = () => {
      const [Component, setComponent] = React.useState<any>(null)
      React.useEffect(() => {
        loader().then((mod) => setComponent(() => mod.default))
      }, [])
      return Component ? <Component /> : <div>Loading...</div>
    }
    return Component
  },
}))

jest.mock('../../../../components/RevolverPicker', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      data-testid="revolver-picker"
    />
  ),
}))

jest.mock('../../../../components/ThemeToggle', () => ({
  __esModule: true,
  default: () => <div>ThemeToggle</div>,
}))

jest.mock('../../../../components/Loading', () => ({
  __esModule: true,
  default: ({ message }: { message?: string }) => <div>Loading: {message}</div>,
}))

jest.mock('../../../../components/Skeleton', () => ({
  VMCardSkeleton: () => <div>VMCardSkeleton</div>,
}))

const React = require('react')
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>
const mockUseCreateVM = useCreateVM as jest.MockedFunction<typeof useCreateVM>
const mockUseVMAction = useVMAction as jest.MockedFunction<typeof useVMAction>
const mockIsAdmin = isAdmin as jest.MockedFunction<typeof isAdmin>

describe('Dashboard Page', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAuth.mockReturnValue({ isAuthenticated: true })
    mockUseCreateVM.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
      error: null,
    } as any)
    mockUseVMAction.mockReturnValue({
      mutate: jest.fn(),
      isLoading: false,
      error: null,
    } as any)
    mockIsAdmin.mockResolvedValue(false)
  })

  it('renders dashboard when authenticated', async () => {
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('ThemeToggle')).toBeInTheDocument()
    }, { timeout: 3000 })
  })

  it('shows authenticating message when not authenticated', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false })

    render(<DashboardPage />)

    expect(screen.getByText(/authenticating/i)).toBeInTheDocument()
  })
})

