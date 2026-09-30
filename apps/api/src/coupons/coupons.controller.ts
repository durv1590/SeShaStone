import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupons.dto';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@Controller()
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('coupons/validate')
  @HttpCode(200)
  async validate(@CurrentUser() user: AuthUser, @Body() dto: ValidateCouponDto) {
    const { coupon, discount } = await this.coupons.evaluate(dto.code, user.id, dto.subtotal);
    return { code: coupon.code, description: coupon.description, discount };
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/coupons')
  list() {
    return this.coupons.list();
  }

  @Roles(Role.ADMIN)
  @Post('admin/coupons')
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/coupons/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Delete('admin/coupons/:id')
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}
