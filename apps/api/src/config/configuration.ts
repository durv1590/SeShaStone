export default () => ({
  port: Number(process.env.PORT ?? 4000),
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  s3: {
    region: process.env.S3_REGION ?? 'ap-south-1',
    bucket: process.env.S3_BUCKET ?? 'seshastone-media',
    endpoint: process.env.S3_ENDPOINT || undefined,
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    publicUrl: process.env.S3_PUBLIC_URL ?? '',
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  },
  search: {
    host: process.env.SEARCH_HOST ?? 'http://localhost:7700',
    apiKey: process.env.SEARCH_API_KEY ?? '',
  },
  payments: {
    defaultProvider: process.env.PAYMENT_DEFAULT_PROVIDER ?? 'RAZORPAY',
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID ?? '',
      keySecret: process.env.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
    },
    cashfree: {
      appId: process.env.CASHFREE_APP_ID ?? '',
      secretKey: process.env.CASHFREE_SECRET_KEY ?? '',
      env: process.env.CASHFREE_ENV ?? 'sandbox',
    },
  },
});
