import type { JewelleryLine } from './api';

export interface LineConfig {
  key: 'gold' | 'silver' | 'diamond' | 'premium-artificial';
  line: JewelleryLine;
  label: string;
  short: string;
  path: string;
  intro: string;
  /** Subcategory slugs shown for this line (must exist as categories). */
  subcategories: { slug: string; label: string }[];
}

/** The four jewellery lines. URLs: /gold, /gold/rings, /premium-artificial/necklaces … */
export const LINES: LineConfig[] = [
  {
    key: 'gold',
    line: 'GOLD',
    label: 'Gold Jewellery',
    short: 'Gold',
    path: '/gold',
    intro: 'Heirloom gold, crafted to be worn every day and treasured for generations.',
    subcategories: [
      { slug: 'rings', label: 'Rings' },
      { slug: 'earrings', label: 'Earrings' },
      { slug: 'necklaces', label: 'Necklaces' },
      { slug: 'pendants', label: 'Pendants' },
      { slug: 'bracelets', label: 'Bracelets' },
      { slug: 'bangles', label: 'Bangles' },
      { slug: 'chains', label: 'Chains' },
      { slug: 'nose-pins', label: 'Nose Pins' },
    ],
  },
  {
    key: 'silver',
    line: 'SILVER',
    label: 'Silver Jewellery',
    short: 'Silver',
    path: '/silver',
    intro: 'Pure, graceful silver for moments both everyday and extraordinary.',
    subcategories: [
      { slug: 'rings', label: 'Rings' },
      { slug: 'earrings', label: 'Earrings' },
      { slug: 'anklets', label: 'Anklets' },
      { slug: 'bracelets', label: 'Bracelets' },
      { slug: 'necklaces', label: 'Necklaces' },
      { slug: 'pendants', label: 'Pendants' },
    ],
  },
  {
    key: 'diamond',
    line: 'DIAMOND',
    label: 'Diamond Jewellery',
    short: 'Diamond',
    path: '/diamond',
    intro: 'Diamonds chosen for their light and set to let it shine.',
    subcategories: [
      { slug: 'rings', label: 'Diamond Rings' },
      { slug: 'earrings', label: 'Diamond Earrings' },
      { slug: 'necklaces', label: 'Diamond Necklaces' },
      { slug: 'pendants', label: 'Diamond Pendants' },
      { slug: 'bracelets', label: 'Diamond Bracelets' },
    ],
  },
  {
    key: 'premium-artificial',
    line: 'ARTIFICIAL',
    label: 'Premium Artificial Jewellery',
    short: 'Premium Artificial',
    path: '/premium-artificial',
    intro: 'Statement fashion jewellery with a premium finish. Not made of gold, silver or diamond.',
    subcategories: [
      { slug: 'rings', label: 'Fashion Rings' },
      { slug: 'earrings', label: 'Fashion Earrings' },
      { slug: 'necklaces', label: 'Necklaces' },
      { slug: 'bridal-sets', label: 'Bridal Fashion' },
    ],
  },
];

export const lineByKey = (key: string) => LINES.find((l) => l.key === key);
export const lineByEnum = (line: JewelleryLine | null | undefined) => LINES.find((l) => l.line === line);

export const LINE_LABEL: Record<JewelleryLine, string> = {
  GOLD: 'Gold',
  SILVER: 'Silver',
  DIAMOND: 'Diamond',
  ARTIFICIAL: 'Premium Artificial',
};
