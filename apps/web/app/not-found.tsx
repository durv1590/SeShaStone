import Link from 'next/link';
import { BrandMark } from '@/components/brand';

export default function NotFound() {
  return (
    <div className="container section" style={{ textAlign: 'center', display: 'grid', justifyItems: 'center', gap: 16 }}>
      <span style={{ color: 'var(--color-accent-ink)' }}><BrandMark size={72} /></span>
      <h1>This page could not be found</h1>
      <p className="muted">The piece or page you were looking for may have moved.</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link href="/" className="btn">Go to home</Link>
        <Link href="/search" className="btn btn--outline">Search jewellery</Link>
      </div>
    </div>
  );
}
