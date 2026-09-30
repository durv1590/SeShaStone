'use client';

import Link from 'next/link';
import { formatPrice } from '@/lib/format';
import { useStore } from '@/lib/store';

export default function CartPage() {
  const { cart, updateQuantity } = useStore();
  const subtotal = cart.reduce((sum, l) => sum + l.price * l.quantity, 0);

  if (!cart.length) {
    return (
      <div className="container section">
        <h1 className="section-title">Your bag is empty</h1>
        <Link href="/products" className="btn">Continue shopping</Link>
      </div>
    );
  }

  return (
    <div className="container section two-col">
      <div>
        <h1 className="section-title">Your bag</h1>
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Qty</th><th>Total</th></tr>
          </thead>
          <tbody>
            {cart.map((l) => (
              <tr key={l.variantId}>
                <td>
                  <Link href={`/products/${l.slug}`}>{l.productName}</Link>
                  <div className="muted">{l.variantTitle}</div>
                </td>
                <td>
                  <select value={l.quantity} onChange={(e) => updateQuantity(l.variantId, Number(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n === 0 ? 'Remove' : n}</option>
                    ))}
                  </select>
                </td>
                <td>{formatPrice(l.price * l.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <aside className="summary">
        <div className="summary-row"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
        <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>Shipping and offers applied at checkout.</p>
        <Link href="/checkout" className="btn btn-block">Checkout</Link>
      </aside>
    </div>
  );
}
