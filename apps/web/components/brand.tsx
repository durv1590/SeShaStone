import { MONOGRAM, WORDMARK } from './brand-paths';

/**
 * SS monogram, drawn from the same path data as the logo files (no font dependency).
 * The two S letters interlock on any background.
 */
export function BrandMark({ size = 40, title, className }: { size?: number; title?: string; className?: string }) {
  const id = `ss-${size}`;
  const { width: w, height: h, gap, weave, back, front } = MONOGRAM;
  const box = { x: -10, y: -10, width: w + 20, height: h + 20 };
  const knockout = (d: string) => <path d={d} fill="#000" stroke="#000" strokeWidth={gap * 2} strokeLinejoin="round" />;
  return (
    <svg
      className={className}
      width={(size * w) / h}
      height={size}
      viewBox={`-2 -2 ${w + 4} ${h + 4}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {/* Each S is cut by a hairline knockout of the other where it passes underneath; `weave` is where the order flips. */}
      <clipPath id={`${id}o`}>
        <path clipRule="evenodd" d={`M-10 -10H${w + 10}V${h + 10}H-10Z${weave}`} />
      </clipPath>
      <clipPath id={`${id}i`}>
        <path d={weave} />
      </clipPath>
      <mask id={`${id}a`} maskUnits="userSpaceOnUse" {...box}>
        <rect {...box} fill="#fff" />
        <g clipPath={`url(#${id}o)`}>{knockout(front)}</g>
      </mask>
      <mask id={`${id}b`} maskUnits="userSpaceOnUse" {...box}>
        <rect {...box} fill="#fff" />
        <g clipPath={`url(#${id}i)`}>{knockout(back)}</g>
      </mask>
      <g fill="currentColor">
        <path d={back} mask={`url(#${id}a)`} />
        <path d={front} mask={`url(#${id}b)`} />
      </g>
    </svg>
  );
}

/** Wordmark "SeSha Stone" as a vector path. */
export function Wordmark({ height = 22, className }: { height?: number; className?: string }) {
  return (
    <svg className={className} width={(height * WORDMARK.width) / WORDMARK.height} height={height} viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`} aria-hidden="true">
      <path d={WORDMARK.d} fill="currentColor" />
    </svg>
  );
}

/**
 * Primary logo: monogram + wordmark (+ optional PVT. LTD.). `compact` shows the monogram only
 * (used on mobile). Colours follow `currentColor` / CSS tokens via the variant class.
 */
export function BrandLogo({
  variant = 'champagne',
  compact = false,
  legal = false,
  size = 34,
}: {
  variant?: 'champagne' | 'primary' | 'reverse' | 'mono';
  compact?: boolean;
  legal?: boolean;
  size?: number;
}) {
  return (
    <span className={`brand-logo brand-logo--${variant}`}>
      <span className="brand-logo__mark"><BrandMark size={size} /></span>
      {!compact && (
        <span className="brand-logo__text">
          <Wordmark height={size * 0.62} className="brand-logo__word" />
          {legal && <span className="brand-logo__legal">PVT. LTD.</span>}
        </span>
      )}
      <span className="sr-only">SeSha Stone{legal ? ' Pvt. Ltd.' : ''}</span>
    </span>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export type IconName =
  | 'gold'
  | 'silver'
  | 'diamond'
  | 'artificial'
  | 'authentic'
  | 'secure'
  | 'delivery'
  | 'returns'
  | 'support'
  | 'search'
  | 'user'
  | 'heart'
  | 'bag'
  | 'menu'
  | 'close'
  | 'phone'
  | 'whatsapp'
  | 'truck'
  | 'mail'
  | 'chevron';

const ICONS: Record<IconName, React.ReactNode> = {
  gold: (
    <>
      <path d="M17 6c-4 0-6 2-6 4.5S13 14 16 15s5 2.5 5 5-2 5-6 5" {...stroke} />
      <path d="M21 10c-.8-2.4-2.4-4-4-4M11 22c1 2 2.5 3 4 3" {...stroke} />
    </>
  ),
  silver: (
    <>
      <circle cx="16" cy="16" r="9" {...stroke} />
      <ellipse cx="16" cy="16" rx="4" ry="9" {...stroke} />
      <path d="M7 16h18" {...stroke} />
    </>
  ),
  diamond: (
    <>
      <path d="M6 12l4-5h12l4 5-10 14z" {...stroke} />
      <path d="M6 12h20M13 7l-2 5 5 14 5-14-2-5" {...stroke} />
    </>
  ),
  artificial: (
    <>
      <circle cx="16" cy="16" r="2.5" {...stroke} />
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse key={deg} cx="16" cy="9" rx="3" ry="5" transform={`rotate(${deg} 16 16)`} {...stroke} />
      ))}
    </>
  ),
  authentic: (
    <>
      <path d="M16 4l9 4v7c0 6-4 10-9 13-5-3-9-7-9-13V8z" {...stroke} />
      <path d="M12 16l3 3 5-6" {...stroke} />
    </>
  ),
  secure: (
    <>
      <rect x="8" y="14" width="16" height="12" rx="2" {...stroke} />
      <path d="M11 14v-3a5 5 0 0110 0v3" {...stroke} />
    </>
  ),
  delivery: (
    <>
      <path d="M4 9h14v12H4zM18 13h5l4 4v4h-9" {...stroke} />
      <circle cx="9" cy="23" r="2" {...stroke} />
      <circle cx="22" cy="23" r="2" {...stroke} />
    </>
  ),
  truck: (
    <>
      <path d="M4 9h14v12H4zM18 13h5l4 4v4h-9" {...stroke} />
      <circle cx="9" cy="23" r="2" {...stroke} />
      <circle cx="22" cy="23" r="2" {...stroke} />
    </>
  ),
  returns: (
    <>
      <path d="M8 12a9 9 0 1 1-1 7" {...stroke} />
      <path d="M8 6v6h6" {...stroke} />
    </>
  ),
  support: (
    <>
      <path d="M7 18v-3a9 9 0 0118 0v3" {...stroke} />
      <rect x="5" y="17" width="4" height="7" rx="1.5" {...stroke} />
      <rect x="23" y="17" width="4" height="7" rx="1.5" {...stroke} />
    </>
  ),
  search: (
    <>
      <circle cx="14" cy="14" r="8" {...stroke} />
      <path d="M20 20l7 7" {...stroke} />
    </>
  ),
  user: (
    <>
      <circle cx="16" cy="11" r="5" {...stroke} />
      <path d="M6 27c1.5-5 5.5-8 10-8s8.5 3 10 8" {...stroke} />
    </>
  ),
  heart: <path d="M16 27s-11-6.5-11-14a6 6 0 0111-3.3A6 6 0 0127 13c0 7.5-11 14-11 14z" {...stroke} />,
  bag: (
    <>
      <path d="M7 11h18l-1.5 16h-15z" {...stroke} />
      <path d="M12 11V9a4 4 0 018 0v2" {...stroke} />
    </>
  ),
  menu: <path d="M5 10h22M5 16h22M5 22h22" {...stroke} />,
  close: <path d="M8 8l16 16M24 8L8 24" {...stroke} />,
  phone: <path d="M10 5l4 5-2.5 2.5a14 14 0 008 8L22 18l5 4-2 4c-9 0-19-10-19-19z" {...stroke} />,
  whatsapp: (
    <>
      <path d="M6 26l1.8-5A10.5 10.5 0 1111 24.2z" {...stroke} />
      <path d="M12 12c0 4 4 8 8 8l1.5-2-2.5-1.5-1.2 1.2c-1.5-.6-2.9-2-3.5-3.5l1.2-1.2L14 10.5z" {...stroke} />
    </>
  ),
  mail: (
    <>
      <rect x="5" y="8" width="22" height="16" rx="1.5" {...stroke} />
      <path d="M5 9l11 8 11-8" {...stroke} />
    </>
  ),
  chevron: <path d="M12 8l8 8-8 8" {...stroke} />,
};

export function Icon({ name, size = 22, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {ICONS[name]}
    </svg>
  );
}

const TRUST_ICONS: IconName[] = ['authentic', 'secure', 'delivery', 'returns', 'support'];

/** Trust messages come from Admin → Settings so only claims the business supports are shown. */
export function TrustBar({ points }: { points: string[] }) {
  if (!points.length) return null;
  return (
    <section className="trust" aria-label="Why shop with SeSha Stone">
      <div className="container trust__inner">
        {points.map((label, i) => (
          <div key={label} className="trust__item">
            <Icon name={TRUST_ICONS[i % TRUST_ICONS.length]} size={26} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
