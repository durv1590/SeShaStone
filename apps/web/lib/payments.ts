'use client';

import { api } from './api';

interface InitiateResponse {
  paymentId: string;
  provider: 'RAZORPAY' | 'CASHFREE';
  clientPayload: Record<string, unknown>;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
    Cashfree?: (opts: { mode: 'sandbox' | 'production' }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget: '_modal' }) => Promise<{ error?: { message: string } }>;
    };
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment gateway'));
    document.body.appendChild(script);
  });
}

/**
 * Opens the gateway checkout for an order and resolves once the API has verified payment.
 * provider: RAZORPAY | CASHFREE | UPI (UPI is routed via the store's default gateway);
 * omit it to use the store's default gateway.
 */
export async function payForOrder(orderId: string, token: string, provider?: string) {
  const init = await api<InitiateResponse>('/payments/initiate', {
    method: 'POST',
    token,
    body: JSON.stringify({ orderId, provider }),
  });

  if (init.provider === 'RAZORPAY') {
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const payload = await new Promise<Record<string, string>>((resolve, reject) => {
      const rzp = new window.Razorpay!({
        ...init.clientPayload,
        theme: { color: '#8c6a2f' },
        handler: (response: Record<string, string>) => resolve(response),
        modal: { ondismiss: () => reject(new Error('Payment was cancelled')) },
      });
      rzp.open();
    });
    return api('/payments/verify', {
      method: 'POST',
      token,
      body: JSON.stringify({ paymentId: init.paymentId, payload }),
    });
  }

  await loadScript('https://sdk.cashfree.com/js/v3/cashfree.js');
  const mode = process.env.NEXT_PUBLIC_CASHFREE_MODE === 'production' ? 'production' : 'sandbox';
  const result = await window.Cashfree!({ mode }).checkout({
    paymentSessionId: String(init.clientPayload.paymentSessionId),
    redirectTarget: '_modal',
  });
  if (result.error) throw new Error(result.error.message);
  return api('/payments/verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ paymentId: init.paymentId, payload: {} }),
  });
}
