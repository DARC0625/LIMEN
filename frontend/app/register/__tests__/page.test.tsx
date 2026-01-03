/**
 * app/register/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import RegisterPage from '../page'

// 의존성 모킹
jest.mock('../../../components/RegisterForm', () => ({
  __esModule: true,
  default: () => <div>RegisterForm</div>,
}))

describe('Register Page', () => {
  it('renders register form', () => {
    render(<RegisterPage />)

    expect(screen.getByText('RegisterForm')).toBeInTheDocument()
  })
})

