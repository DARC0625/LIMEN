'use client';

import { useState } from 'react';
import { authAPI, setToken } from '../lib/api';
import { useRouter } from 'next/navigation';
import { useToast } from './ToastContainer';
import { getErrorMessage } from '../lib/types/errors';
import { isValidUsername, isValidPassword, sanitizeInput } from '../lib/utils/validation';

export default function RegisterForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 입력 sanitization (XSS 방지)
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedPassword = password; // 비밀번호는 sanitization하지 않음 (특수문자 포함 가능)

    // Validation
    if (!isValidUsername(sanitizedUsername)) {
      setError('사용자 이름은 3-20자의 영문, 숫자, 언더스코어(_), 하이픈(-)만 사용할 수 있습니다.');
      return;
    }
    
    if (!isValidPassword(sanitizedPassword)) {
      setError('비밀번호는 최소 8자 이상이며, 영문, 숫자, 특수문자 중 2가지 이상을 포함해야 합니다.');
      return;
    }
    
    if (sanitizedPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setLoading(true);

    try {
      // Sanitized username 사용
      const response = await authAPI.register({ username: sanitizedUsername, password: sanitizedPassword });
      toast.success('계정이 생성되었습니다! 관리자 승인을 기다려주세요.');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      const errorMessage = getErrorMessage(err);
      setError(errorMessage);
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-colors">
        <header>
          <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100">Create Account</h1>
          <p className="mt-2 text-center text-gray-600 dark:text-gray-400">LIMEN VM Management Platform</p>
        </header>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} aria-label="Registration form">
          {error && (
            <div 
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded transition-colors"
              role="alert"
              aria-live="assertive"
            >
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                minLength={3}
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="At least 3 characters"
                aria-describedby="username-help"
                aria-invalid={!!error && error.includes('username')}
              />
              <p id="username-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Username must be at least 3 characters long
              </p>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                placeholder="At least 6 characters"
                aria-describedby="password-help"
                aria-invalid={!!error && error.includes('password')}
              />
              <p id="password-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Password must be at least 6 characters long
              </p>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                aria-describedby="confirm-password-help"
                aria-invalid={!!error && error.includes('match')}
              />
              <p id="confirm-password-help" className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Re-enter your password to confirm
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              aria-busy={loading}
              aria-label={loading ? 'Creating account, please wait' : 'Create new account'}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              aria-label="Navigate back to login page"
            >
              Back to Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

