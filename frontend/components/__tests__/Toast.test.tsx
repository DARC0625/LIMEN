/**
 * Toast 컴포넌트 테스트
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastComponent from '../Toast';
import type { Toast } from '../Toast';

describe('Toast', () => {
  const createToast = (overrides?: Partial<Toast>): Toast => ({
    id: 'test-toast-1',
    message: 'Test message',
    type: 'info',
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders toast message', () => {
    const toast = createToast();
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders with success type', () => {
    const toast = createToast({ type: 'success' });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    const toastElement = screen.getByText('Test message').closest('div');
    expect(toastElement).toHaveClass('bg-green-500');
  });

  it('renders with error type', () => {
    const toast = createToast({ type: 'error' });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    const toastElement = screen.getByText('Test message').closest('div');
    expect(toastElement).toHaveClass('bg-red-500');
  });

  it('renders with warning type', () => {
    const toast = createToast({ type: 'warning' });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    const toastElement = screen.getByText('Test message').closest('div');
    expect(toastElement).toHaveClass('bg-yellow-500');
  });

  it('renders with info type', () => {
    const toast = createToast({ type: 'info' });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    const toastElement = screen.getByText('Test message').closest('div');
    expect(toastElement).toHaveClass('bg-blue-500');
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const toast = createToast();
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    
    const closeButton = screen.getByRole('button');
    await user.click(closeButton);
    
    expect(onClose).toHaveBeenCalledWith('test-toast-1');
  });

  it('auto-closes after default duration', async () => {
    const toast = createToast();
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    
    expect(onClose).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(3000);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('test-toast-1');
    });
  });

  it('auto-closes after custom duration', async () => {
    const toast = createToast({ duration: 5000 });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    
    expect(onClose).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(5000);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('test-toast-1');
    });
  })

  it('has proper ARIA attributes', () => {
    const toast = createToast();
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    
    const toastElement = screen.getByRole('alert');
    expect(toastElement).toHaveAttribute('aria-live', 'assertive');
    expect(toastElement).toHaveAttribute('aria-atomic', 'true');
  })

  it('displays correct icon for each type', () => {
    const types: Array<'success' | 'error' | 'info' | 'warning'> = ['success', 'error', 'info', 'warning'];
    
    types.forEach(type => {
      const toast = createToast({ type });
      const onClose = jest.fn();
      const { container } = render(<ToastComponent toast={toast} onClose={onClose} />);
      
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });
  })

  it('has accessible close button', () => {
    const toast = createToast({ message: 'Test notification' });
    const onClose = jest.fn();
    render(<ToastComponent toast={toast} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText(/close.*notification/i);
    expect(closeButton).toBeInTheDocument();
  })

  it('cleans up timer on unmount', () => {
    const toast = createToast();
    const onClose = jest.fn();
    const { unmount } = render(<ToastComponent toast={toast} onClose={onClose} />);
    
    unmount();
    
    // 타이머가 정리되었는지 확인 (onClose가 호출되지 않아야 함)
    jest.advanceTimersByTime(3000);
    expect(onClose).not.toHaveBeenCalled();
  })

  it('updates timer when duration changes', async () => {
    const toast = createToast({ duration: 5000 });
    const onClose = jest.fn();
    const { rerender } = render(<ToastComponent toast={toast} onClose={onClose} />);
    
    // duration 변경
    const newToast = createToast({ duration: 2000 });
    rerender(<ToastComponent toast={newToast} onClose={onClose} />);
    
    // 새로운 duration으로 타이머가 설정되었는지 확인
    jest.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledWith('test-toast-1');
    });
  })
})

