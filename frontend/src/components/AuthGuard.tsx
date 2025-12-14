'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import LoginForm from './LoginForm';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsAuthenticated(false);
      return;
    }
    
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      if (!token || token.trim() === '') {
        setIsAuthenticated(false);
        return false;
      }
      
      // Decode token to check approval status
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const decoded = JSON.parse(jsonPayload);
        
        // Check if user is approved (admin users are always approved)
        const isApproved = decoded.role === 'admin' || decoded.approved === true;
        
        if (!isApproved) {
          // Remove invalid token
          localStorage.removeItem('auth_token');
          setIsAuthenticated(false);
          return false;
        }
        
        setIsAuthenticated(true);
        return true;
      } catch (e) {
        // Invalid token, remove it
        localStorage.removeItem('auth_token');
        setIsAuthenticated(false);
        return false;
      }
    };
    
    // Initial check
    checkAuth();
    
    // Listen for storage changes (for logout from other tabs and same-tab updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        checkAuth();
      }
    };
    
    // Custom event for same-tab token updates
    const handleTokenUpdate = () => {
      checkAuth();
    };
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('authTokenUpdated', handleTokenUpdate);
    
    // Also check periodically (in case token was removed in same tab)
    const interval = setInterval(() => {
      checkAuth();
    }, 500);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('authTokenUpdated', handleTokenUpdate);
    };
  }, [pathname]); // Re-check when pathname changes

  // Public paths that don't require authentication
  const publicPaths = ['/login', '/register'];
  const isPublicPath = publicPaths.includes(pathname);

  // Show loading only briefly
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // If not authenticated and not on public path, show login
  if (!isAuthenticated && !isPublicPath) {
    return <LoginForm />;
  }

  // Return children with proper wrapper to preserve styles
  return <div className="min-h-screen">{children}</div>;
}
