import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Sign in', path: '/login', noindex: true });

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
