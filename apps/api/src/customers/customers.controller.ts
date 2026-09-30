import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
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

  @RequirePermissions('customers.view')
  @Get('admin/customers')
  list(@Query() query: ListCustomersDto) {
    return this.customers.list(query);
  }

  @RequirePermissions('customers.view')
  @Get('admin/customers/:id')
  findOne(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  @RequirePermissions('customers.manage')
  @Patch('admin/customers/:id')
  update(@Param('id') id: string, @Body() dto: AdminUpdateCustomerDto) {
    return this.customers.adminUpdate(id, dto);
  }
}
