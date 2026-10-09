import localFont from 'next/font/local';

// Brand typography — two families only (brand/seshastone-brand-reference.png, master brief §6):
// Cormorant Garamond for display and product names, Montserrat for body, UI and prices.
// The font files are bundled (SIL Open Font License, see ./fonts/OFL-*.txt), so builds never
// depend on downloading from Google Fonts and visitors' browsers never contact Google.
export const display = localFont({
  src: [
    { path: './fonts/cormorant-garamond-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-500-italic.woff2', weight: '500', style: 'italic' },
    { path: './fonts/cormorant-garamond-latin-600-normal.woff2', weight: '600', style: 'normal' },
    { path: './fonts/cormorant-garamond-latin-600-italic.woff2', weight: '600', style: 'italic' },
  ],
  variable: '--font-display',
  display: 'swap',
  // Size the stand-in shown while the font loads from a serif (as next/font/google did), so wide
  // sans-serif capitals never make headings overflow during the swap.
  adjustFontFallback: 'Times New Roman',
  fallback: ['Georgia', 'Times New Roman', 'serif'],
});
export const body = localFont({
  src: [
    { path: './fonts/montserrat-latin-400-normal.woff2', weight: '400', style: 'normal' },
    { path: './fonts/montserrat-latin-500-normal.woff2', weight: '500', style: 'normal' },
    { path: './fonts/montserrat-latin-600-normal.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-body',
  display: 'swap',
  fallback: ['Helvetica Neue', 'Arial', 'sans-serif'],
});

export const fontVariables = `${display.variable} ${body.variable}`;
