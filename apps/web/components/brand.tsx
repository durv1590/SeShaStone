import { CollectionKey } from '@/lib/collections';

/** Interlocking “SS” monogram in champagne gold. */
export function Monogram({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <text
        x="9"
        y="36"
        fontSize="34"
        fontStyle="italic"
        fill="currentColor"
        style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
      >
        S
      </text>
      <text
        x="19"
        y="42"
        fontSize="34"
        fontStyle="italic"
        fill="currentColor"
        stroke="var(--logo-gap, #1b1b1b)"
        strokeWidth="1.5"
        paintOrder="stroke"
        style={{ fontFamily: 'var(--font-display), Georgia, serif' }}
      >
        S
      </text>
    </svg>
  );
}

/** Monogram + “SeSha Stone” wordmark, with optional “PVT. LTD.” line. */
export function Logo({ legal = false, size = 36 }: { legal?: boolean; size?: number }) {
  return (
    <span className="logo">
      <Monogram size={size} className="logo-mark" />
      <span className="logo-text">
        <span className="logo-word">SeSha Stone</span>
        {legal && <span className="logo-legal">PVT. LTD.</span>}
      </span>
    </span>
  );
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** Line icons for the collection tiles and trust bar. */
export function BrandIcon({ name, size = 28 }: { name: CollectionKey | TrustKey; size?: number }) {
  const paths: Record<CollectionKey | TrustKey, React.ReactNode> = {
    gold: (
      <>
        <path d="M17 6c-4 0-6 2-6 4.5S13 14 16 15s5 2.5 5 5-2 5-6 5" {...stroke} />
        <path d="M11 22c1 2 2.5 3 4 3" {...stroke} />
        <path d="M21 10c-.8-2.4-2.4-4-4-4" {...stroke} />
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
        <circle cx="16" cy="20" r="1.5" {...stroke} />
      </>
    ),
    delivery: (
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
        <path d="M25 24c0 2-2 3-5 3h-2" {...stroke} />
      </>
    ),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export type TrustKey = 'authentic' | 'secure' | 'delivery' | 'returns' | 'support';

export const TRUST_POINTS: { key: TrustKey; label: string }[] = [
  { key: 'authentic', label: '100% Authentic Jewellery' },
  { key: 'secure', label: 'Secure Online Shopping' },
  { key: 'delivery', label: 'Pan India Delivery' },
  { key: 'returns', label: 'Easy Returns' },
  { key: 'support', label: 'Dedicated Customer Support' },
];

export function TrustBar() {
  return (
    <section className="trust" aria-label="Why shop with us">
      <div className="container trust-inner">
        {TRUST_POINTS.map((t) => (
          <div key={t.key} className="trust-item">
            <BrandIcon name={t.key} size={26} />
            <span>{t.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
