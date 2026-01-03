/**
 * Loading 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react';
import Loading from '../Loading';

describe('Loading', () => {
  it('renders loading spinner', () => {
    render(<Loading />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
  });

  it('displays default message', () => {
    render(<Loading />);
    // 메시지는 p 태그에 표시됨
    expect(screen.getByText('Loading...', { selector: 'p' })).toBeInTheDocument();
  });

  it('displays custom message', () => {
    render(<Loading message="Please wait..." />);
    // 메시지는 p 태그와 sr-only에 모두 있으므로 getAllByText 사용
    const messages = screen.getAllByText('Please wait...');
    expect(messages.length).toBeGreaterThan(0);
    // p 태그에 표시되는 메시지 확인
    expect(screen.getByText('Please wait...', { selector: 'p' })).toBeInTheDocument();
  });

  it('renders with small size', () => {
    render(<Loading size="sm" />);
    const spinner = screen.getByRole('status');
    const spinnerElement = spinner.querySelector('div[aria-hidden="true"]');
    expect(spinnerElement).toHaveClass('w-4', 'h-4');
  });

  it('renders with medium size (default)', () => {
    render(<Loading />);
    const spinner = screen.getByRole('status');
    const spinnerElement = spinner.querySelector('div[aria-hidden="true"]');
    expect(spinnerElement).toHaveClass('w-8', 'h-8');
  });

  it('renders with large size', () => {
    render(<Loading size="lg" />);
    const spinner = screen.getByRole('status');
    const spinnerElement = spinner.querySelector('div[aria-hidden="true"]');
    expect(spinnerElement).toHaveClass('w-12', 'h-12');
  });

  it('has proper ARIA attributes', () => {
    render(<Loading message="Loading data" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toHaveAttribute('aria-live', 'polite');
    expect(spinner).toHaveAttribute('aria-label', 'Loading data');
  });

  it('has screen reader text', () => {
    render(<Loading message="Loading data" />);
    // sr-only 요소 확인
    const srOnly = screen.getByText('Loading data', { selector: 'span.sr-only' });
    expect(srOnly).toBeInTheDocument();
    expect(srOnly).toHaveClass('sr-only');
  });

  it('renders without message', () => {
    render(<Loading message="" />);
    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');
    // 빈 메시지일 때는 sr-only에 기본 메시지 표시
    expect(screen.getByText('Loading, please wait', { selector: '.sr-only' })).toBeInTheDocument();
  });
});

