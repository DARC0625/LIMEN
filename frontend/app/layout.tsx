import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from '../components/ToastContainer';
import { QueryProvider } from '../components/QueryProvider';
import { ThemeProvider } from '../components/ThemeProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import WebVitalsClient from '../components/WebVitalsClient';
import PWARegister from '../components/PWARegister';

export const metadata: Metadata = {
  title: "LIMEN - VM Management Platform",
  description: "Cross the limen. Break the boundaries. Web-based virtual machine management platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 초기 테마 적용 스크립트 (FOUC 방지) - suppressHydrationWarning으로 경고 억제 */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme') || 'system';
                  let resolvedTheme = theme;
                  if (theme === 'system') {
                    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (resolvedTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* noVNC OS 감지 함수 전역 설정 + rfb.css 제거 (모든 스크립트 로드 전에 실행) */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                'use strict';
                // rfb.css 링크 즉시 제거 (서버 사이드에서 추가된 것도 제거)
                const removeRfbCss = () => {
                  const allLinks = document.querySelectorAll('link');
                  let removed = 0;
                  allLinks.forEach(link => {
                    const href = link.href || link.getAttribute('href') || '';
                    if (href.includes('rfb.css') || href.includes('@novnc/novnc')) {
                      link.remove();
                      removed++;
                    }
                  });
                  if (removed > 0) {
                    console.log('[rfb.css] Removed', removed, 'link(s)');
                  }
                };
                // 즉시 실행 (서버 사이드에서 추가된 링크 제거)
                if (typeof document !== 'undefined' && document.head) {
                  removeRfbCss();
                }
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', () => {
                    if (document.head) removeRfbCss();
                  });
                }
                // MutationObserver로 동적 추가도 즉시 제거
                if (typeof document !== 'undefined' && document.head && document.body) {
                  const observer = new MutationObserver(() => {
                    removeRfbCss();
                  });
                  try {
                    observer.observe(document.head, { childList: true, subtree: true });
                    observer.observe(document.body, { childList: true, subtree: true });
                  } catch (e) {
                    console.warn('[rfb.css] MutationObserver setup failed:', e);
                  }
                }
                
                // noVNC가 l.isWindows와 c.isMac으로 접근하는 문제 해결
                // 가장 먼저 실행되어야 함 (noVNC 로드 전)
                const isWindowsFn = function() {
                  return typeof navigator !== 'undefined' &&
                         /Win/i.test(navigator.platform || navigator.userAgent || '');
                };
                
                const isMacFn = function() {
                  return typeof navigator !== 'undefined' &&
                         /Mac/i.test(navigator.platform || navigator.userAgent || '');
                };
                
                // window.l과 window.c를 가장 먼저 설정 (noVNC가 로드되기 전)
                if (typeof window !== 'undefined') {
                  // window.l 객체 설정 (noVNC가 l.isWindows로 접근)
                  if (!window.l) {
                    window.l = {};
                  }
                  // 직접 함수 할당 + defineProperty로 보호
                  window.l.isWindows = isWindowsFn;
                  try {
                    Object.defineProperty(window.l, 'isWindows', {
                      value: isWindowsFn,
                      writable: false,
                      configurable: true,
                      enumerable: true,
                    });
                  } catch(e) {
                    window.l.isWindows = isWindowsFn;
                  }
                  
                  // window.c 객체 설정 (noVNC가 c.isMac으로 접근)
                  if (!window.c) {
                    window.c = {};
                  }
                  // 직접 함수 할당 + defineProperty로 보호
                  window.c.isMac = isMacFn;
                  try {
                    Object.defineProperty(window.c, 'isMac', {
                      value: isMacFn,
                      writable: false,
                      configurable: true,
                      enumerable: true,
                    });
                  } catch(e) {
                    window.c.isMac = isMacFn;
                  }
                  
                  // 추가 보호: 주기적으로 재설정 (noVNC가 덮어쓸 수 있으므로)
                  setInterval(function() {
                    if (window.l && typeof window.l.isWindows !== 'function') {
                      window.l.isWindows = isWindowsFn;
                    }
                    if (window.c && typeof window.c.isMac !== 'function') {
                      window.c.isMac = isMacFn;
                    }
                  }, 100); // 100ms마다 확인
                  
                  // 추가 전역 설정
                  window.isWindows = isWindowsFn;
                  window.isMac = isMacFn;
                  
                  // globalThis에도 설정
                  if (typeof globalThis !== 'undefined') {
                    if (!globalThis.l) globalThis.l = window.l;
                    if (!globalThis.c) globalThis.c = window.c;
                    globalThis.isWindows = isWindowsFn;
                    globalThis.isMac = isMacFn;
                  }
                  
                  // exports와 module 정의 (noVNC 호환성)
                  // 전역 변수로도 설정 (noVNC가 직접 참조할 수 있도록)
                  try {
                    if (typeof exports === 'undefined') {
                      window.exports = {};
                      // 전역 exports도 설정
                      (function() {
                        var exports = {};
                        try {
                          Object.defineProperty(window, 'exports', {
                            value: exports,
                            writable: true,
                            configurable: true,
                          });
                        } catch(e) {
                          window.exports = exports;
                        }
                      })();
                    }
                    if (typeof module === 'undefined') {
                      window.module = { exports: window.exports };
                      try {
                        Object.defineProperty(window, 'module', {
                          value: { exports: window.exports },
                          writable: true,
                          configurable: true,
                        });
                      } catch(e) {
                        window.module = { exports: window.exports };
                      }
                    }
                  } catch(e) {
                    console.warn('[noVNC Setup] Failed to set exports/module:', e);
                  }
                  
                  console.log('[noVNC Setup] Initialized with Turbopack');
                }
              })();
            `,
          }}
        />
        {/* noVNC CSS는 컴포넌트에서 동적으로 로드 - CDN 링크 제거됨 */}
        {/* 폰트 스타일시트 로드 */}
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LIMEN" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body 
        className="antialiased" 
        suppressHydrationWarning 
        style={{ 
          fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif',
          margin: 0,
          padding: 0,
          minHeight: '100vh',
          width: '100%',
          backgroundColor: 'var(--background, #ffffff)',
          color: 'var(--foreground, #171717)',
          overflowX: 'hidden'
        }}
      >
        {/* 스크립트 로드 에러 핸들링 및 rfb.css 제거 */}
        <Script
          id="script-error-handler"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // rfb.css 링크 즉시 제거 (MIME 타입 오류 방지)
                const removeRfbCss = () => {
                  const links = document.querySelectorAll('link[href*="rfb.css"], link[href*="@novnc/novnc"][href*="rfb.css"]');
                  links.forEach(link => {
                    link.remove();
                    console.log('[rfb.css] Removed:', link.href);
                  });
                  
                  // preload 링크도 제거
                  const preloads = document.querySelectorAll('link[rel="preload"][href*="rfb.css"]');
                  preloads.forEach(link => {
                    link.remove();
                    console.log('[rfb.css] Removed preload:', link.href);
                  });
                };
                
                // 즉시 실행 (스크립트가 head에 있으므로)
                removeRfbCss();
                
                // DOMContentLoaded에서도 실행
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', removeRfbCss);
                }
                
                // MutationObserver로 동적으로 추가되는 링크도 즉시 제거
                const observer = new MutationObserver((mutations) => {
                  mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                      if (node.nodeName === 'LINK') {
                        const href = node.href || node.getAttribute('href') || '';
                        if (href.includes('rfb.css')) {
                          node.remove();
                          console.log('[rfb.css] Removed dynamically added:', href);
                        }
                      }
                    });
                  });
                });
                observer.observe(document.head, { childList: true, subtree: true });
                
                // 스크립트 로드 에러 핸들링
                window.addEventListener('error', function(e) {
                  if (e.target && e.target.tagName === 'SCRIPT' && e.target.src) {
                    // Next.js 청크 파일 로드 실패 처리
                    const src = e.target.src;
                    if (src.includes('/_next/static/chunks/') || src.includes('/next/static/chunks/')) {
                      // 경로 문제 감지 (프록시 설정 문제일 수 있음)
                      if (src.includes('/next/static/') && !src.includes('/_next/static/')) {
                        console.warn('[Script Load] 잘못된 경로 감지 (프록시 설정 확인 필요):', src);
                      } else {
                        console.warn('[Script Load] 청크 파일 로드 실패 (빌드 버전 불일치 가능):', src);
                      }
                      // 에러는 무시 (프록시 문제 또는 빌드 버전 불일치)
                      e.preventDefault();
                      return false;
                    }
                  }
                  // CSS 로드 에러도 무시 (rfb.css)
                  if (e.target && e.target.tagName === 'LINK' && e.target.href && e.target.href.includes('rfb.css')) {
                    e.preventDefault();
                    return false;
                  }
                }, true);
              })();
            `,
          }}
        />
        {/* 스크린 리더를 위한 라이브 영역 */}
        <div id="aria-live-region" aria-live="polite" aria-atomic="true" className="sr-only"></div>
        <ErrorBoundary>
          <ThemeProvider>
            <QueryProvider>
              <ToastProvider>
                <WebVitalsClient />
                <PWARegister />
                {children}
              </ToastProvider>
            </QueryProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}