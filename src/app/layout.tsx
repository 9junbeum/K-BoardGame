import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오목 온라인 — 친구와 링크로 함께",
  description: "가입 없이 링크 하나로 친구와 오목을 두는 곳.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router 루트 레이아웃이라 모든 페이지에 적용됨 (규칙은 pages/ 기준 오탐) */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
