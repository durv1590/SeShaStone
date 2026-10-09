import type { NextConfig } from 'next';
import { join } from 'node:path';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the production Docker image (deploy/).
  output: 'standalone',
  outputFileTracingRoot: join(__dirname, '../..'),
  poweredByHeader: false,
};

export default nextConfig;
