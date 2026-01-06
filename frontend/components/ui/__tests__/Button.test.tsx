/**
 * UI Button 컴포넌트 테스트
 */

import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../Button'

describe('Button', () => {
  it('renders with children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByText('Click me'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('applies primary variant by default', () => {
    const { container } = render(<Button>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-blue-600')
  })

  it('applies secondary variant', () => {
    const { container } = render(<Button variant="secondary">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-gray-200')
  })

  it('applies danger variant', () => {
    const { container } = render(<Button variant="danger">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-red-600')
  })

  it('applies ghost variant', () => {
    const { container } = render(<Button variant="ghost">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('bg-transparent')
  })

  it('applies small size', () => {
    const { container } = render(<Button size="sm">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')
  })

  it('applies medium size by default', () => {
    const { container } = render(<Button>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('px-4', 'py-2', 'text-base')
  })

  it('applies large size', () => {
    const { container } = render(<Button size="lg">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('px-6', 'py-3', 'text-lg')
  })

  it('shows loading state', () => {
    render(<Button isLoading>Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
    // 로딩 스피너 확인
    const spinner = screen.getByText('Click me').parentElement?.querySelector('svg')
    expect(spinner).toBeInTheDocument()
  })

  it('is disabled when isLoading is true', () => {
    const { container } = render(<Button isLoading>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toBeDisabled()
  })

  it('is disabled when disabled prop is true', () => {
    const { container } = render(<Button disabled>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toBeDisabled()
  })

  it('applies custom className', () => {
    const { container } = render(<Button className="custom-class">Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveClass('custom-class')
  })

  it('passes through other props', () => {
    const { container } = render(<Button type="submit" data-testid="custom-button">Click me</Button>)
    const button = container.querySelector('button[type="submit"]')
    expect(button).toBeInTheDocument()
  })

  it('has correct aria attributes when loading', () => {
    const { container } = render(<Button isLoading>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })

  it('has correct aria attributes when disabled', () => {
    const { container } = render(<Button disabled>Click me</Button>)
    const button = container.querySelector('button')
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })
})





