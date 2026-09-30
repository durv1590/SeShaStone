import { Cormorant_Garamond, Inter, Montserrat, Playfair_Display } from 'next/font/google';

// Brand typography (brand/seshastone-brand-reference.png):
// Playfair Display — headings · Montserrat — body & buttons
// Cormorant Garamond — product names · Inter — prices
export const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
export const body = Montserrat({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
export const product = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-product',
  display: 'swap',
});
export const numeric = Inter({ subsets: ['latin'], variable: '--font-numeric', display: 'swap' });

export const fontVariables = [display, body, product, numeric].map((f) => f.variable).join(' ');
