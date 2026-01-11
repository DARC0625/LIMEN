import type { Metadata } from "next";
import "./globals.css";

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
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
