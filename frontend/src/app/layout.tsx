import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import AuthGuard from '../components/AuthGuard';
import { ToastProvider } from '../components/ToastContainer';

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
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body className="antialiased" style={{ fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif' }}>
        <ToastProvider>
          <AuthGuard>{children}</AuthGuard>
        </ToastProvider>
      </body>
    </html>
  );
}
