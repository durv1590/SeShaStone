import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Bundled font file (SIL Open Font License, see ./fonts/), so builds never download from Google Fonts.
const display = localFont({
  src: './fonts/cormorant-garamond-latin-600-normal.woff2',
  weight: '600',
  variable: '--font-display',
  display: 'swap',
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'serif'],
});

export const metadata: Metadata = {
  title: { default: 'Admin · SeSha Stone', template: '%s · SeSha Stone Admin' },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={display.variable}>
      <body>{children}</body>
    </html>
  );
}
