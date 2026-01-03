// Error types for better type safety

export interface AppError {
  message: string;
  code?: string;
  statusCode?: number;
}

export interface APIError {
  error: string;
  message?: string;
  statusCode?: number;
}

// Type guard for APIError
export function isAPIError(error: unknown): error is APIError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as APIError).error === 'string'
  );
}

// Type guard for AppError
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as AppError).message === 'string'
  );
}

// Extract error message from unknown error
export function getErrorMessage(error: unknown): string {
  if (isAPIError(error)) {
    return error.message || error.error || 'An error occurred';
  }
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

