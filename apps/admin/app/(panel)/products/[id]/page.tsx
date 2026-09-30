'use client';

import { use, useState } from 'react';
import { api } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { ProductFields, ProductFieldsForm } from '@/components/product-form';

interface Variant {
  id: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice: number | null;
  isActive: boolean;
  inventory: { quantity: number; reserved: number } | null;
}

type Product = ProductFields & { id: string; slug: string; variants: Variant[] };

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: product, error, reload } = useApi<Product>(`/admin/products/${id}`);
  const [saved, setSaved] = useState(false);

  async function editPrice(v: Variant) {
    const input = prompt(`New price for ${v.sku} (₹)`, String(v.price / 100));
    if (!input) return;
    await api(`/admin/variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ price: Math.round(Number(input) * 100) }) });
    await reload();
  }

  async function toggle(v: Variant) {
    await api(`/admin/variants/${v.id}`, { method: 'PATCH', body: JSON.stringify({ isActive: !v.isActive }) });
    await reload();
  }

  if (error) return <p className="error">{error}</p>;
  if (!product) return null;

  return (
    <>
      <h1>{product.name}</h1>
      <ProductFieldsForm
        key={product.id}
        initial={product}
        submitLabel={saved ? 'Saved ✓' : 'Save changes'}
        onSubmit={async (fields) => {
          await api(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
          setSaved(true);
          await reload();
        }}
      >
        <div className="panel">
          <h2>Variants</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Title</th><th className="num">On hand</th><th className="num">Reserved</th><th className="num">Price</th><th>Active</th><th /></tr>
              </thead>
              <tbody>
                {product.variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.sku}</td>
                    <td>{v.title}</td>
                    <td className="num">{v.inventory?.quantity ?? 0}</td>
                    <td className="num">{v.inventory?.reserved ?? 0}</td>
                    <td className="num">{formatPrice(v.price)}</td>
                    <td>{v.isActive ? 'Yes' : 'No'}</td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => editPrice(v)}>Edit price</button>{' '}
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(v)}>{v.isActive ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">Adjust stock from the Inventory page.</p>
        </div>
      </ProductFieldsForm>
    </>
  );
}
