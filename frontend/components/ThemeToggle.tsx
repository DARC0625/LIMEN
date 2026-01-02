'use client';

import { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleThemeSelect = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme);
    setIsOpen(false);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    // 우클릭: 메뉴 열기
    e.preventDefault();
    setIsOpen(!isOpen);
  };

  return (
    <div className="flex items-center gap-2">
      {/* 테마 선택 드롭다운 */}
      <div className="relative">
        <button
          ref={buttonRef}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
          onClick={handleButtonClick}
          onContextMenu={handleContextMenu}
          aria-label="Toggle theme"
          title={`Current: ${resolvedTheme} (${theme}) - Click to toggle, Right-click for menu`}
        >
          {resolvedTheme === 'dark' ? (
            // 달 아이콘 (다크 모드)
            <svg
              className="w-5 h-5 text-gray-700 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          ) : (
            // 태양 아이콘 (라이트 모드)
            <svg
              className="w-5 h-5 text-gray-700 dark:text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          )}
        </button>

        {/* 테마 선택 메뉴 (우클릭 시 표시) */}
        {isOpen && (
          <div
            ref={menuRef}
            className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 animate-in fade-in slide-in-from-top-2 duration-200"
            role="menu"
            aria-orientation="vertical"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-1">
              <button
                onClick={() => handleThemeSelect('light')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 ${
                  theme === 'light'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>라이트</span>
                  {theme === 'light' && <span className="ml-auto">✓</span>}
                </div>
              </button>
              <button
                onClick={() => handleThemeSelect('dark')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 ${
                  theme === 'dark'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span>다크</span>
                  {theme === 'dark' && <span className="ml-auto">✓</span>}
                </div>
              </button>
              <button
                onClick={() => handleThemeSelect('system')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700 ${
                  theme === 'system'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                role="menuitem"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>시스템</span>
                  {theme === 'system' && <span className="ml-auto">✓</span>}
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

