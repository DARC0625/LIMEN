/**
 * StatusCard 컴포넌트 테스트
 */

import { render, screen } from '@testing-library/react';
import { StatusCard, StatusRow, ProgressBar } from '../StatusCard';

describe('StatusCard', () => {
  it('renders status card with title', () => {
    render(
      <StatusCard title="Test Card" status="ok">
        <div>Content</div>
      </StatusCard>
    );
    expect(screen.getByText('Test Card')).toBeInTheDocument();
  });

  it('renders with ok status', () => {
    render(
      <StatusCard title="Test Card" status="ok">
        <div>Content</div>
      </StatusCard>
    );
    const statusIndicator = screen.getByLabelText('Status: OK');
    expect(statusIndicator).toHaveClass('bg-green-500');
  });

  it('renders with error status', () => {
    render(
      <StatusCard title="Test Card" status="error">
        <div>Content</div>
      </StatusCard>
    );
    const statusIndicator = screen.getByLabelText('Status: Error');
    expect(statusIndicator).toHaveClass('bg-red-500');
  });

  it('renders subStatus when provided', () => {
    render(
      <StatusCard title="Test Card" status="ok" subStatus="v1.0.0">
        <div>Content</div>
      </StatusCard>
    );
    expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    expect(screen.getByLabelText('Sub status: v1.0.0')).toBeInTheDocument();
  });

  it('renders children content', () => {
    render(
      <StatusCard title="Test Card" status="ok">
        <div data-testid="content">Test Content</div>
      </StatusCard>
    );
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('does not render subStatus when not provided', () => {
    render(
      <StatusCard title="Test Card" status="ok">
        <div>Content</div>
      </StatusCard>
    );
    expect(screen.queryByLabelText(/Sub status:/)).not.toBeInTheDocument();
  });
});

describe('StatusRow', () => {
  it('renders status row with label and value', () => {
    render(<StatusRow label="Status" value="connected" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('connected')).toBeInTheDocument();
  });

  it('applies connected status styling', () => {
    render(<StatusRow label="Status" value="connected" />);
    const valueElement = screen.getByText('connected');
    expect(valueElement).toHaveClass('bg-green-100');
  });

  it('applies offline status styling', () => {
    render(<StatusRow label="Status" value="Offline" />);
    const valueElement = screen.getByText('Offline');
    expect(valueElement).toHaveClass('bg-red-100');
  });

  it('applies loading status styling', () => {
    render(<StatusRow label="Status" value="Loading..." />);
    const valueElement = screen.getByText('Loading...');
    expect(valueElement).toHaveClass('bg-red-100');
  });

  it('renders without value', () => {
    render(<StatusRow label="Status" />);
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('handles unknown status', () => {
    render(<StatusRow label="Status" value="Unknown" />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('renders progress bar with label and value', () => {
    render(<ProgressBar label="CPU" value={75} color="bg-blue-500" />);
    expect(screen.getByText('CPU')).toBeInTheDocument();
    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });

  it('displays correct percentage', () => {
    render(<ProgressBar label="Memory" value={50.5} color="bg-purple-500" />);
    expect(screen.getByText('50.5%')).toBeInTheDocument();
  });

  it('caps value at 100%', () => {
    render(<ProgressBar label="Disk" value={150} color="bg-red-500" />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('handles zero value', () => {
    render(<ProgressBar label="Network" value={0} color="bg-green-500" />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('applies custom color', () => {
    const { container } = render(<ProgressBar label="Test" value={50} color="bg-custom-500" />);
    const progressBar = container.querySelector('.bg-custom-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('has proper ARIA attributes', () => {
    render(<ProgressBar label="CPU" value={75} color="bg-blue-500" />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '75');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    expect(progressBar).toHaveAttribute('aria-label', 'CPU: 75.0%');
  });

  it('has aria-label for percentage display', () => {
    render(<ProgressBar label="Memory" value={60} color="bg-purple-500" />);
    const percentageDisplay = screen.getByLabelText('Memory: 60.0 percent');
    expect(percentageDisplay).toBeInTheDocument();
  });
});

