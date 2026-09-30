import type { Metadata } from 'next';
import { Cormorant_Garamond } from 'next/font/google';
import './globals.css';

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['600'], variable: '--font-display', display: 'swap' });

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
