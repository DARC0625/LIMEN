'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // 시스템 테마 감지
  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  // 실제 적용될 테마 계산
  const getResolvedTheme = (currentTheme: Theme): 'light' | 'dark' => {
    if (currentTheme === 'system') {
      return getSystemTheme();
    }
    return currentTheme;
  };

  // 테마 적용
  const applyTheme = (newTheme: Theme) => {
    if (typeof window === 'undefined') return;
    
    const resolved = getResolvedTheme(newTheme);
    const root = document.documentElement;
    
    // Tailwind CSS는 dark 클래스만 필요
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    setResolvedTheme(resolved);
  };

  // 초기화
  useEffect(() => {
    // localStorage에서 저장된 테마 불러오기
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    const initialTheme = (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) 
      ? savedTheme 
      : 'system';
    
    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, [applyTheme]);

  // 시스템 테마 변경 감지
  useEffect(() => {
    if (!mounted || theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted, applyTheme]);

  // 테마 변경 핸들러
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  // 테마 토글 (light <-> dark, system은 건너뜀)
  const toggleTheme = () => {
    const currentResolved = getResolvedTheme(theme);
    const newTheme = currentResolved === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  // SSR 방지: 마운트 전에도 Context 제공 (기본값 사용)
  // 마운트 전에는 기본값을 제공하여 useTheme 에러 방지
  const contextValue: ThemeContextType = mounted
    ? { theme, resolvedTheme, setTheme, toggleTheme }
    : {
        theme: 'system',
        resolvedTheme: 'light',
        setTheme: () => {},
        toggleTheme: () => {},
      };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

