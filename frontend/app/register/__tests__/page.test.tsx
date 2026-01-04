/**
 * app/register/page.tsx 테스트
 */

import { render, screen } from '@testing-library/react'
import RegisterPage from '../page'

// RegisterForm 모킹
jest.mock('../../../components/RegisterForm', () => ({
  __esModule: true,
  default: () => <div>Register Form</div>,
}))

describe('RegisterPage', () => {
  it('renders register form', () => {
    render(<RegisterPage />)

    expect(screen.getByText('Register Form')).toBeInTheDocument()
  })
})
