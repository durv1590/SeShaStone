import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminUpdateCustomerDto, ListCustomersDto, UpdateProfileDto } from './customers.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Controller()
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me/profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.customers.findOne(user.id);
  }

  @Patch('me/profile')
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.customers.updateProfile(user.id, dto);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/customers')
  list(@Query() query: ListCustomersDto) {
    return this.customers.list(query);
  }

  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/customers/:id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Patch('admin/customers/:id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateCustomerDto) {
    return this.customers.adminUpdate(id, dto);
  }
}
