import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Create account', path: '/register', noindex: true });

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
