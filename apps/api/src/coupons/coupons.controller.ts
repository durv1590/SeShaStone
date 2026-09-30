import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
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

  @RequirePermissions('marketing.manage')
  @Get('admin/coupons')
  list() {
    return this.coupons.list();
  }

  @RequirePermissions('marketing.manage')
  @Post('admin/coupons')
  create(@Body() dto: CreateCouponDto) {
    return this.coupons.create(dto);
  }

  @RequirePermissions('marketing.manage')
  @Patch('admin/coupons/:id')
  update(@Param('id') id: string, @Body() dto: UpdateCouponDto) {
    return this.coupons.update(id, dto);
  }

  @RequirePermissions('marketing.manage')
  @Delete('admin/coupons/:id')
  remove(@Param('id') id: string) {
    return this.coupons.remove(id);
  }
}
