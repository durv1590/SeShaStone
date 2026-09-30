import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { StorageModule } from './storage/storage.module';
import { SearchModule } from './search/search.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { HealthModule } from './health/health.module';
import { CustomersModule } from './customers/customers.module';
import { AddressesModule } from './addresses/addresses.module';
import { CategoriesModule } from './categories/categories.module';
import { ProductsModule } from './products/products.module';
import { InventoryModule } from './inventory/inventory.module';
import { CouponsModule } from './coupons/coupons.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { ReviewsModule } from './reviews/reviews.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { CmsModule } from './cms/cms.module';
import { MarketingModule } from './marketing/marketing.module';
import { SettingsModule } from './settings/settings.module';
import { AuditModule } from './audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';
import { UsersModule } from './users/users.module';
import { CollectionsModule } from './collections/collections.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Default: 120 requests per minute per IP; sensitive endpoints set stricter limits.
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      // Automated test runs only; never honoured in production.
      skipIf: () => process.env.E2E_DISABLE_RATE_LIMIT === 'true' && process.env.NODE_ENV !== 'production',
    }),
    // Infrastructure
    PrismaModule,
    RedisModule,
    StorageModule,
    SearchModule,
    AuditModule,
    NotificationsModule,
    // Domain
    AuthModule,
    HealthModule,
    CustomersModule,
    AddressesModule,
    CategoriesModule,
    CollectionsModule,
    ProductsModule,
    InventoryModule,
    CouponsModule,
    OrdersModule,
    PaymentsModule,
    ReviewsModule,
    WishlistModule,
    CmsModule,
    MarketingModule,
    SettingsModule,
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Every route requires a JWT unless marked @Public(); @RequirePermissions() narrows further.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
