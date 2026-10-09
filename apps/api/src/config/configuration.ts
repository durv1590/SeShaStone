export default () => ({
  port: Number(process.env.PORT ?? 4000),
  webUrl: process.env.WEB_URL ?? 'http://localhost:3000',
  smtp: {
    host: process.env.SMTP_HOST || undefined,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || undefined,
    pass: process.env.SMTP_PASS || undefined,
    from: process.env.SMTP_FROM || undefined,
  },
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
  storage: {
    // "s3" (S3, R2 or MinIO, uploaded by presigned URL) or "local" (files on this server's disk).
    driver: process.env.STORAGE_DRIVER === 'local' ? 'local' : 's3',
    mediaDir: process.env.MEDIA_DIR ?? '/data/media',
    /** Public base URL the web server serves MEDIA_DIR from, e.g. https://www.seshastone.com/media */
    mediaUrl: process.env.MEDIA_PUBLIC_URL ?? '',
    /** Public base URL of this API, used to build local upload links, e.g. https://api.seshastone.com/api/v1 */
    apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000/api/v1',
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
