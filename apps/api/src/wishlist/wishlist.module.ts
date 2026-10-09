import { Body, Controller, Delete, Get, Injectable, Module, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

class AddWishlistItemDto {
  @IsString() productId: string;
}

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  list(customerId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            images: { orderBy: { sortOrder: 'asc' }, take: 1 },
            variants: { where: { isActive: true }, select: { price: true }, orderBy: { price: 'asc' }, take: 1 },
          },
        },
      },
    });
  }

  add(customerId: string, productId: string) {
    return this.prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId, productId } },
      create: { customerId, productId },
      update: {},
    });
  }

  async remove(customerId: string, productId: string) {
    await this.prisma.wishlistItem.deleteMany({ where: { customerId, productId } });
    return { deleted: true };
  }
}

@ApiTags('wishlist')
@ApiBearerAuth()
@Controller('me/wishlist')
class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.wishlist.list(user.id);
  }

  @Post()
  add(@CurrentUser() user: AuthUser, @Body() dto: AddWishlistItemDto) {
    return this.wishlist.add(user.id, dto.productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthUser, @Param('productId') productId: string) {
    return this.wishlist.remove(user.id, productId);
  }
}

@Module({
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
