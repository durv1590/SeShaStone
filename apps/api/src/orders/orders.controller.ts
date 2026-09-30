import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CheckoutDto, ListOrdersDto, QuoteDto, UpdateOrderStatusDto } from './orders.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller()
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout/quote')
  @HttpCode(200)
  async quote(@CurrentUser() user: AuthUser, @Body() dto: QuoteDto) {
    const { coupon, ...quote } = await this.orders.quote(user.id, dto.items, dto.couponCode);
    return { ...quote, couponCode: coupon?.code ?? null };
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user.id, dto);
  }

  @Get('me/orders')
  listMine(@CurrentUser() user: AuthUser, @Query() query: ListOrdersDto) {
    return this.orders.listMine(user.id, query);
  }

  @Get('me/orders/:id')
  findMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.findMine(user.id, id);
  }

  @Post('me/orders/:id/cancel')
  @HttpCode(200)
  cancelMine(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.orders.cancelMine(user.id, id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/orders')
  adminList(@Query() query: ListOrdersDto) {
    return this.orders.adminList(query);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/dashboard')
  stats() {
    return this.orders.stats();
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/orders/:id')
  adminGet(@Param('id') id: string) {
    return this.orders.adminGet(id);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/orders/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.orders.adminUpdateStatus(id, dto);
  }
}
