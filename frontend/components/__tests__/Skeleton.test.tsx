/**
 * Skeleton 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react';
import Skeleton, { VMCardSkeleton, CardGridSkeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders skeleton element', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders with text variant', () => {
    const { container } = render(<Skeleton variant="text" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveClass('h-4');
  });

  it('renders with circular variant', () => {
    const { container } = render(<Skeleton variant="circular" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveClass('rounded-full');
  });

  it('renders with rectangular variant (default)', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveClass('rounded');
  });

  it('renders with card variant', () => {
    const { container } = render(<Skeleton variant="card" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveClass('rounded-lg');
  });

  it('renders multiple lines for text variant', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    const skeletons = container.querySelectorAll('[aria-hidden="true"]');
    expect(skeletons).toHaveLength(3);
  });

  it('applies custom width and height', () => {
    const { container } = render(<Skeleton width={200} height={100} />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveStyle({ width: '200px', height: '100px' });
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="custom-class" />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveClass('custom-class');
  });

  it('has aria-hidden attribute', () => {
    const { container } = render(<Skeleton />);
    const skeleton = container.querySelector('[aria-hidden="true"]');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('VMCardSkeleton', () => {
  it('renders VM card skeleton', () => {
    render(<VMCardSkeleton />);
    const skeletons = screen.getAllByRole('generic', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('CardGridSkeleton', () => {
  it('renders card grid skeleton with default count', () => {
    render(<CardGridSkeleton />);
    const skeletons = screen.getAllByRole('generic', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders card grid skeleton with custom count', () => {
    render(<CardGridSkeleton count={5} />);
    const skeletons = screen.getAllByRole('generic', { hidden: true });
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

