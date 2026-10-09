import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image (deploy/).
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
  poweredByHeader: false,
  async redirects() {
    return [
      // Old product URLs → SEO-friendly /product/:slug
      { source: '/products/:slug', destination: '/product/:slug', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
