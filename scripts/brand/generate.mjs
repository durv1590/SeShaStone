#!/usr/bin/env node
/**
 * Generates the SeSha Stone logo system from the brand fonts.
 *
 *   npm run brand:generate
 *
 * TEMPORARY PLACEHOLDER ARTWORK — no approved logo files have been supplied. These assets follow
 * the brand reference (brand/seshastone-brand-reference.png): an interlocking italic "SS" monogram
 * in Champagne Gold with a Cormorant Garamond wordmark. Replace them with the approved artwork when
 * available; nothing in the app needs to change as long as the file names stay the same.
 *
 * Text is converted to vector paths, so the SVGs render identically without any fonts installed.
 * PNG icons are rendered with Playwright's Chromium (set CHROMIUM_PATH to use a specific binary).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'apps/web/public/brand');
const FONTS = join(ROOT, 'scripts/brand/fonts');

const C = {
  black: '#0D0D0D',
  charcoal: '#181818',
  ivory: '#F7F2E8',
  champagne: '#D9AF57',
  emerald: '#0E4A3A',
};

const font = (file) => {
  const buf = readFileSync(join(FONTS, file));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
};
const serifItalic = font('cormorant-garamond-latin-600-italic.woff');
const serif = font('cormorant-garamond-latin-600-normal.woff');
const sans = font('montserrat-latin-500-normal.woff');

const r = (n) => Math.round(n * 100) / 100;

/** Lays out text as one SVG path. Returns path data and its bounding box. */
function textPath(f, text, size, { tracking = 0, x = 0, y = 0 } = {}) {
  const glyphs = f.stringToGlyphs(text);
  const scale = size / f.unitsPerEm;
  let cursor = x;
  const path = new opentype.Path();
  glyphs.forEach((g, i) => {
    path.extend(g.getPath(cursor, y, size));
    cursor += g.advanceWidth * scale + tracking;
    if (i < glyphs.length - 1) cursor += f.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  const bb = path.getBoundingBox();
  return { d: path.toPathData(2), x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2, advance: cursor - x - tracking };
}

/** Shifts path data so its box starts at (dx, dy). */
function place(p, dx, dy) {
  const t = new opentype.Path();
  // Re-generate by translating commands.
  const cmds = parsePath(p.d).map((c) => ({ ...c, ...shift(c, dx - p.x1, dy - p.y1) }));
  t.commands = cmds;
  return { ...p, d: t.toPathData(2), x2: p.x2 - p.x1 + dx, y2: p.y2 - p.y1 + dy, x1: dx, y1: dy };
}
function shift(c, dx, dy) {
  const o = {};
  for (const k of ['x', 'x1', 'x2']) if (k in c) o[k] = c[k] + dx;
  for (const k of ['y', 'y1', 'y2']) if (k in c) o[k] = c[k] + dy;
  return o;
}
function parsePath(d) {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const out = [];
  let i = 0;
  while (i < tokens.length) {
    const type = tokens[i++];
    const n = () => parseFloat(tokens[i++]);
    if (type === 'M' || type === 'L') out.push({ type, x: n(), y: n() });
    else if (type === 'Q') out.push({ type, x1: n(), y1: n(), x: n(), y: n() });
    else if (type === 'C') out.push({ type, x1: n(), y1: n(), x2: n(), y2: n(), x: n(), y: n() });
    else out.push({ type: 'Z' });
  }
  return out;
}

// ── Monogram: two interlocking italic S ─────────────────────────────
const S1 = textPath(serifItalic, 'S', 100);
const S2 = textPath(serifItalic, 'S', 100);
const OFFSET_X = (S1.x2 - S1.x1) * 0.42;
const OFFSET_Y = (S1.y2 - S1.y1) * 0.16;
const front = place(S2, OFFSET_X, OFFSET_Y);
const back = place(S1, 0, 0);
const mono = { w: r(Math.max(back.x2, front.x2)), h: r(Math.max(back.y2, front.y2)) };
const GAP = 3.2; // knockout where the front S crosses the back S

/** Monogram group. The mask cuts a hairline gap so the letters interlock on any background. */
function monogramGroup(id, color, x = 0, y = 0, scale = 1) {
  return `
  <defs>
    <mask id="${id}" maskUnits="userSpaceOnUse" x="-10" y="-10" width="${mono.w + 20}" height="${mono.h + 20}">
      <rect x="-10" y="-10" width="${mono.w + 20}" height="${mono.h + 20}" fill="#fff"/>
      <path d="${front.d}" fill="#000" stroke="#000" stroke-width="${GAP * 2}" stroke-linejoin="round"/>
    </mask>
  </defs>
  <g transform="translate(${r(x)} ${r(y)}) scale(${r(scale)})" fill="${color}">
    <path d="${back.d}" mask="url(#${id})"/>
    <path d="${front.d}"/>
  </g>`;
}

// ── Wordmark ───────────────────────────────────────────────────────
const WORD_SIZE = 100;
const word = textPath(serif, 'SeSha Stone', WORD_SIZE, { tracking: 1.5 });
const legal = textPath(sans, 'PVT. LTD.', 22, { tracking: 11 });
const tagline = textPath(sans, 'TIMELESS ELEGANCE', 16, { tracking: 8 });

const HEADER = '<!-- TEMPORARY PLACEHOLDER: not the approved SeSha Stone logo. See scripts/brand/generate.mjs -->';
const svg = (w, h, body, title) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r(w)} ${r(h)}" width="${r(w)}" height="${r(h)}" role="img" aria-label="${title}">
${HEADER}
<title>${title}</title>${body}
</svg>
`;

/** Horizontal lockup: monogram + wordmark (+ PVT. LTD.). */
function horizontal(markColor, textColor, subColor, id) {
  const markScale = 1.15;
  const markW = mono.w * markScale;
  const markH = mono.h * markScale;
  const gap = 34;
  const wordW = word.x2 - word.x1;
  const wordH = word.y2 - word.y1;
  const legalW = legal.x2 - legal.x1;
  const blockH = wordH + 16 + (legal.y2 - legal.y1);
  const h = Math.max(markH, blockH) + 8;
  const textX = markW + gap;
  const wordY = (h - blockH) / 2;
  const w = textX + Math.max(wordW, legalW);
  const wd = place(word, textX, wordY);
  const lg = place(legal, textX + (wordW - legalW) / 2, wordY + wordH + 16);
  return svg(
    w,
    h,
    `${monogramGroup(id, markColor, 0, (h - markH) / 2, markScale)}
  <path d="${wd.d}" fill="${textColor}"/>
  <path d="${lg.d}" fill="${subColor}"/>`,
    'SeSha Stone Pvt. Ltd.',
  );
}

/** Stacked lockup as on the brand board: monogram over wordmark, legal line, tagline. */
function stacked(color, textColor, id) {
  const markScale = 1.6;
  const markW = mono.w * markScale;
  const wordW = word.x2 - word.x1;
  const legalW = legal.x2 - legal.x1;
  const tagW = tagline.x2 - tagline.x1;
  const w = Math.max(markW, wordW, legalW, tagW) + 20;
  let y = 0;
  const markH = mono.h * markScale;
  const parts = [monogramGroup(id, color, (w - markW) / 2, y, markScale)];
  y += markH + 24;
  const wd = place(word, (w - wordW) / 2, y);
  y += word.y2 - word.y1 + 18;
  const lg = place(legal, (w - legalW) / 2, y);
  y += legal.y2 - legal.y1 + 22;
  const tg = place(tagline, (w - tagW) / 2, y);
  y += tagline.y2 - tagline.y1 + 4;
  parts.push(`<path d="${wd.d}" fill="${textColor}"/>`, `<path d="${lg.d}" fill="${textColor}"/>`, `<path d="${tg.d}" fill="${color}"/>`);
  return svg(w, y, parts.join('\n  '), 'SeSha Stone Pvt. Ltd. — Timeless Elegance');
}

function wordmarkOnly(color) {
  const wordW = word.x2 - word.x1;
  const legalW = legal.x2 - legal.x1;
  const wd = place(word, 0, 0);
  const lg = place(legal, (wordW - legalW) / 2, word.y2 - word.y1 + 16);
  return svg(wordW, lg.y2 + 2, `<path d="${wd.d}" fill="${color}"/>\n  <path d="${lg.d}" fill="${color}"/>`, 'SeSha Stone Pvt. Ltd.');
}

function monogramOnly(color, id) {
  const pad = 6;
  return svg(mono.w + pad * 2, mono.h + pad * 2, monogramGroup(id, color, pad, pad), 'SeSha Stone monogram');
}

/** Square icon: monogram centred on a background tile. */
function icon(size, bg, color, { radius = 0.18, fill = 0.62 } = {}) {
  const scale = (size * fill) / Math.max(mono.w, mono.h);
  const x = (size - mono.w * scale) / 2;
  const y = (size - mono.h * scale) / 2;
  const rect = `<rect width="${size}" height="${size}" rx="${r(size * radius)}" fill="${bg}"/>`;
  return svg(size, size, `${rect}${monogramGroup('m', color, x, y, scale)}`, 'SeSha Stone');
}

// ── Write files ─────────────────────────────────────────────────────
const files = {
  'logo/sesha-stone-primary.svg': horizontal(C.champagne, C.charcoal, C.charcoal, 'mp'),
  'logo/sesha-stone-champagne.svg': horizontal(C.champagne, C.champagne, C.ivory, 'mc'),
  'logo/sesha-stone-reverse.svg': horizontal(C.ivory, C.ivory, C.ivory, 'mr'),
  'logo/sesha-stone-monochrome.svg': horizontal(C.black, C.black, C.black, 'mb'),
  'logo/sesha-stone-stacked.svg': stacked(C.champagne, C.ivory, 'ms'),
  'logo/sesha-stone-secondary.svg': wordmarkOnly(C.charcoal),
  'logo/sesha-stone-monogram.svg': monogramOnly(C.champagne, 'mm'),
  'favicon/favicon.svg': icon(64, C.charcoal, C.champagne),
};
for (const [name, content] of Object.entries(files)) {
  mkdirSync(dirname(join(OUT, name)), { recursive: true });
  writeFileSync(join(OUT, name), content);
}
// Next.js file-convention icons for both apps.
writeFileSync(join(ROOT, 'apps/web/app/icon.svg'), files['favicon/favicon.svg']);
writeFileSync(join(ROOT, 'apps/admin/app/icon.svg'), files['favicon/favicon.svg']);

// React components use the same path data, so the site never depends on font loading for the logo.
writeFileSync(
  join(ROOT, 'apps/web/components/brand-paths.ts'),
  `// Generated by scripts/brand/generate.mjs — do not edit by hand.
// TEMPORARY PLACEHOLDER artwork until the approved SeSha Stone logo is supplied.
export const MONOGRAM = { width: ${mono.w}, height: ${mono.h}, gap: ${GAP}, back: '${back.d}', front: '${front.d}' } as const;
export const WORDMARK = { width: ${r(word.x2 - word.x1)}, height: ${r(word.y2 - word.y1)}, d: '${place(word, 0, 0).d}' } as const;
`,
);

// ── PNG icons ───────────────────────────────────────────────────────
const pngs = [
  ['favicon/favicon-32.png', 32, C.charcoal, { radius: 0.2, fill: 0.72 }],
  ['favicon/favicon-180.png', 180, C.charcoal, { radius: 0, fill: 0.6 }],
  ['favicon/favicon-512.png', 512, C.charcoal, { radius: 0, fill: 0.6 }],
  ['app-icon/icon-512.png', 512, C.charcoal, { radius: 0, fill: 0.56 }],
  ['app-icon/icon-512-emerald.png', 512, C.emerald, { radius: 0, fill: 0.56 }],
  ['social/profile-icon.png', 1080, C.charcoal, { radius: 0, fill: 0.5 }],
];
try {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage();
  for (const [name, size, bg, opts] of pngs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0">${icon(size, bg, C.champagne, opts)}</body></html>`);
    mkdirSync(dirname(join(OUT, name)), { recursive: true });
    await page.locator('svg').screenshot({ path: join(OUT, name), omitBackground: true });
  }
  // Apple touch icon via Next.js convention.
  await page.setViewportSize({ width: 180, height: 180 });
  await page.setContent(`<html><body style="margin:0">${icon(180, C.charcoal, C.champagne, { radius: 0, fill: 0.6 })}</body></html>`);
  await page.locator('svg').screenshot({ path: join(ROOT, 'apps/web/app/apple-icon.png') });
  await browser.close();
  console.log(`Generated ${Object.keys(files).length} SVGs and ${pngs.length + 1} PNGs in apps/web/public/brand`);
} catch (err) {
  console.warn(`SVGs generated; PNG rendering skipped (${err.message.split('\n')[0]})`);
}
