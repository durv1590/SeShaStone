'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { Icon } from './brand';

export function WishlistButton({ productId, name, className = '' }: { productId: string; name: string; className?: string }) {
  const { wishlist, toggleWishlist } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const saved = wishlist.has(productId);
  return (
    <button
      type="button"
      className={`icon-btn wish-btn ${className}`}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
      onClick={async (e) => {
        e.preventDefault();
        if (!(await toggleWishlist(productId))) router.push(`/login?next=${encodeURIComponent(pathname)}`);
      }}
    >
      <Icon name="heart" size={20} />
    </button>
  );
}
