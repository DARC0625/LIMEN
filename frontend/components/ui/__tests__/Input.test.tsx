/**
 * UI Input 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '../Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toBeInTheDocument()
  })

  it('renders with label', () => {
    render(<Input label="Username" />)
    expect(screen.getByLabelText('Username')).toBeInTheDocument()
  })

  it('renders with required indicator', () => {
    render(<Input label="Username" required />)
    const label = screen.getByText('Username')
    expect(label).toBeInTheDocument()
    const requiredIndicator = label.querySelector('span[aria-label="required"]')
    expect(requiredIndicator).toBeInTheDocument()
  })

  it('displays error message', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
    expect(screen.getByText('This field is required')).toHaveAttribute('role', 'alert')
  })

  it('displays helper text', () => {
    render(<Input helperText="Enter your username" />)
    expect(screen.getByText('Enter your username')).toBeInTheDocument()
  })

  it('does not display helper text when error is present', () => {
    render(<Input error="Error message" helperText="Helper text" />)
    expect(screen.getByText('Error message')).toBeInTheDocument()
    expect(screen.queryByText('Helper text')).not.toBeInTheDocument()
  })

  it('applies error styles when error is present', () => {
    const { container } = render(<Input error="Error message" />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('border-red-300')
  })

  it('applies normal styles when no error', () => {
    const { container } = render(<Input />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('border-gray-300')
  })

  it('handles user input', async () => {
    const user = userEvent.setup()
    render(<Input />)
    const input = screen.getByRole('textbox')
    
    await user.type(input, 'test input')
    expect(input).toHaveValue('test input')
  })

  it('has correct aria attributes when error is present', () => {
    render(<Input error="Error message" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('has correct aria attributes when no error', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-invalid', 'false')
  })

  it('has correct aria-describedby when error is present', () => {
    render(<Input error="Error message" />)
    const input = screen.getByRole('textbox')
    const errorId = input.getAttribute('aria-describedby')
    expect(errorId).toBeTruthy()
    expect(screen.getByText('Error message')).toHaveAttribute('id', errorId)
  })

  it('has correct aria-describedby when helper text is present', () => {
    render(<Input helperText="Helper text" />)
    const input = screen.getByRole('textbox')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(screen.getByText('Helper text')).toHaveAttribute('id', describedBy)
  })

  it('has correct aria-describedby when both error and helper text are present', () => {
    render(<Input error="Error message" helperText="Helper text" />)
    const input = screen.getByRole('textbox')
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // 에러만 표시되므로 에러 ID만 포함 (공백으로 구분된 문자열이므로 split 필요)
    const errorId = describedBy?.split(' ')[0]
    expect(screen.getByText('Error message')).toHaveAttribute('id', errorId)
  })

  it('has correct aria-required when required', () => {
    render(<Input required />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('applies custom className', () => {
    const { container } = render(<Input className="custom-class" />)
    const input = container.querySelector('input')
    expect(input).toHaveClass('custom-class')
  })

  it('passes through other props', () => {
    render(<Input type="email" placeholder="Enter email" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('type', 'email')
    expect(input).toHaveAttribute('placeholder', 'Enter email')
  })

  it('generates unique id when not provided', () => {
    const { container } = render(<Input label="Test" />)
    const input = container.querySelector('input')
    const label = screen.getByText('Test')
    expect(input?.id).toBeTruthy()
    expect(label).toHaveAttribute('for', input?.id)
  })

  it('uses provided id', () => {
    render(<Input id="custom-id" label="Test" />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('id', 'custom-id')
    expect(screen.getByText('Test')).toHaveAttribute('for', 'custom-id')
  })
})

