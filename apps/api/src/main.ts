import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

/** Production must never fall back to the development JWT secret. */
function assertProductionConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const secret = process.env.JWT_SECRET ?? '';
  if (secret.length < 32 || secret === 'dev-secret' || secret.startsWith('change-me')) {
    throw new Error('JWT_SECRET must be set to a random value of at least 32 characters in production.');
  }
}

async function bootstrap() {
  assertProductionConfig();
  // rawBody is required to verify payment gateway webhook signatures.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  // Development and CI only: serve locally stored uploads at /media. In production Caddy serves them.
  if (process.env.SERVE_MEDIA === 'true' && process.env.STORAGE_DRIVER === 'local') {
    app.useStaticAssets(process.env.MEDIA_DIR ?? '/data/media', {
      prefix: '/media',
      index: false,
      dotfiles: 'deny',
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // The storefront and admin run on other origins, so allow them to display the images.
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    });
  }
  // Behind a load balancer / CDN, trust the first proxy so rate limits and audit logs see the client IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('SeSha Stone API')
    .setDescription('REST API for the SeSha Stone jewellery storefront and admin panel')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  app.enableShutdownHooks();
  await app.listen(Number(process.env.PORT ?? 4000));
}

void bootstrap();
