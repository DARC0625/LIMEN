/**
 * Input 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '../ui/Input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
  });

  it('renders input with label', () => {
    render(<Input label="Username" />);
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
  });

  it('renders input with required indicator', () => {
    render(<Input label="Email" required />);
    const label = screen.getByText(/email/i);
    expect(label).toBeInTheDocument();
    // required 표시 확인
    const requiredIndicator = screen.getByLabelText('required');
    expect(requiredIndicator).toBeInTheDocument();
  });

  it('displays error message', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('displays helper text', () => {
    render(<Input helperText="Enter your username" />);
    expect(screen.getByText('Enter your username')).toBeInTheDocument();
  });

  it('applies error styles when error is present', () => {
    render(<Input error="Error message" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-red-300');
  });

  it('applies normal styles when no error', () => {
    render(<Input />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('border-gray-300');
  });

  it('handles user input', async () => {
    const user = userEvent.setup();
    render(<Input />);
    const input = screen.getByRole('textbox');
    
    await user.type(input, 'test input');
    expect(input).toHaveValue('test input');
  });

  it('forwards props to input element', () => {
    render(<Input placeholder="Enter text" type="email" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter text');
    expect(input).toHaveAttribute('type', 'email');
  });

  it('applies custom className', () => {
    render(<Input className="custom-class" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveClass('custom-class');
  });

  it('has aria-describedby when error or helperText is present', () => {
    const { rerender } = render(<Input error="Error" />);
    let input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
    
    rerender(<Input helperText="Helper" />);
    input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby');
    
    rerender(<Input error="Error" helperText="Helper" />);
    input = screen.getByRole('textbox');
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toContain('-error');
    expect(describedBy).toContain('-helper');
  });

  it('has aria-required when required prop is true', () => {
    render(<Input required />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-required', 'true');
  });
});

