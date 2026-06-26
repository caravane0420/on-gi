import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SyncPlay — Watch Together',
  description: 'YouTube 기반 실시간 미디어 동기화 스트리밍 플랫폼. 여러 사용자가 0.5초 미만의 오차로 영상을 동시에 시청합니다.',
  keywords: ['SyncPlay', 'YouTube', '실시간 동기화', '함께 보기', 'Watch Party'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-slate-950">{children}</body>
    </html>
  );
}
