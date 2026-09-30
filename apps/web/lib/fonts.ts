import { Cormorant_Garamond, Montserrat } from 'next/font/google';

// Brand typography — two families only (brand/seshastone-brand-reference.png, master brief §6):
// Cormorant Garamond for display and product names, Montserrat for body, UI and prices.
export const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
export const body = Montserrat({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const fontVariables = `${display.variable} ${body.variable}`;
