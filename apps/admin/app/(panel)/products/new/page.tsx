'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { ProductFieldsForm } from '@/components/product-form';

interface VariantDraft {
  sku: string;
  title: string;
  size: string;
  weightGrams: string;
  price: string;
  compareAtPrice: string;
  stock: string;
}

const emptyVariant: VariantDraft = { sku: '', title: '', size: '', weightGrams: '', price: '', compareAtPrice: '', stock: '0' };
const rupeesToPaise = (v: string) => Math.round(Number(v) * 100);

export default function NewProductPage() {
  const router = useRouter();
  const [variants, setVariants] = useState<VariantDraft[]>([{ ...emptyVariant }]);

  const update = (i: number, key: keyof VariantDraft, value: string) =>
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, [key]: value } : v)));

  return (
    <>
      <h1>New product</h1>
      <ProductFieldsForm
        submitLabel="Create product"
        onSubmit={async (fields) => {
          const created = await api<{ id: string }>('/admin/products', {
            method: 'POST',
            body: JSON.stringify({
              ...fields,
              variants: variants.map((v) => ({
                sku: v.sku,
                title: v.title || v.size || 'Default',
                size: v.size || undefined,
                weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
                price: rupeesToPaise(v.price),
                compareAtPrice: v.compareAtPrice ? rupeesToPaise(v.compareAtPrice) : undefined,
                stock: Number(v.stock) || 0,
              })),
            }),
          });
          router.push(`/products/${created.id}`);
        }}
      >
        <div className="panel">
          <h2>Variants</h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>SKU</th><th>Title</th><th>Size</th><th>Weight (g)</th><th>Price (₹)</th><th>MRP (₹)</th><th>Stock</th><th /></tr>
              </thead>
              <tbody>
                {variants.map((v, i) => (
                  <tr key={i}>
                    {(['sku', 'title', 'size', 'weightGrams', 'price', 'compareAtPrice', 'stock'] as const).map((key) => (
                      <td key={key}>
                        <input
                          className="input"
                          style={{ width: key === 'sku' || key === 'title' ? 150 : 90 }}
                          value={v[key]}
                          required={key === 'sku' || key === 'price'}
                          type={key === 'sku' || key === 'title' || key === 'size' ? 'text' : 'number'}
                          step="any"
                          onChange={(e) => update(i, key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td>
                      {variants.length > 1 && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}>
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setVariants([...variants, { ...emptyVariant }])}>
            Add variant
          </button>
        </div>
      </ProductFieldsForm>
    </>
  );
}
