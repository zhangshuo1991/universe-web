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
  title: 'Universe Web | Solar System Observer',
  description: 'Real ephemeris Solar System observatory with dual-mode exploration, analysis, and LLM control hooks.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>{children}</body>
    </html>
  );
}
