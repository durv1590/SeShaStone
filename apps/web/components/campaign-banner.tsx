import Link from 'next/link';
import type { Banner } from '@/lib/api';

/**
 * CMS campaign banner with art-directed images: desktop 1920×700, tablet 1280×700,
 * mobile 1080×1350. The browser downloads only the image for the current viewport.
 */
export function CampaignBanner({ banner, eager = false }: { banner: Banner; eager?: boolean }) {
  const content = (
    <>
      <picture>
        {banner.mobileImageUrl && <source media="(max-width: 767px)" srcSet={banner.mobileImageUrl} />}
        {banner.tabletImageUrl && <source media="(max-width: 1279px)" srcSet={banner.tabletImageUrl} />}
        <img src={banner.imageUrl} alt="" loading={eager ? 'eager' : 'lazy'} decoding="async" />
      </picture>
      <div className="campaign__copy">
        <h2>{banner.title}</h2>
        {banner.subtitle && <p>{banner.subtitle}</p>}
        {banner.linkUrl && <span className="btn btn--gold" style={{ justifySelf: 'start' }}>{banner.ctaLabel || 'Explore'}</span>}
      </div>
    </>
  );
  return banner.linkUrl ? (
    <Link href={banner.linkUrl} className="campaign" aria-label={banner.title}>{content}</Link>
  ) : (
    <div className="campaign">{content}</div>
  );
}
