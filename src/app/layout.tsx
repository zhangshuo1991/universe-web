import type { Metadata } from 'next';
import { Literata, Oxanium } from 'next/font/google';

import '@/app/globals.css';

const bodyFont = Literata({
  subsets: ['latin'],
  variable: '--font-body'
});

const displayFont = Oxanium({
  subsets: ['latin'],
  variable: '--font-display'
});

export const metadata: Metadata = {
  title: 'Universe Web | Earth Observer',
  description: '基于 CesiumJS 的地球观测站 — 实时卫星追踪、天气数据、地震监测、空间天气和 AI 驱动分析。'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
