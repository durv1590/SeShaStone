import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateReviewDto, ListReviewsDto, ModerateReviewDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Public()
  @Get('products/:productId/reviews')
  forProduct(@Param('productId') productId: string, @Query() query: PaginationDto) {
    return this.reviews.forProduct(productId, query);
  }

  @ApiBearerAuth()
  @Post('reviews')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.id, dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Get('admin/reviews')
  adminList(@Query() query: ListReviewsDto) {
    return this.reviews.adminList(query);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.STAFF)
  @Patch('admin/reviews/:id')
  moderate(@Param('id') id: string, @Body() dto: ModerateReviewDto) {
    return this.reviews.moderate(id, dto.status);
  }
}
