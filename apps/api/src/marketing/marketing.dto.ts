import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEmail, IsOptional, IsString } from 'class-validator';

export class SubscribeDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() source?: string;
}

export class CreateCampaignDto {
  @IsString() name: string;
  @IsString() subject: string;
  @IsString() content: string;
  @IsOptional() @Type(() => Date) @IsDate() scheduledAt?: Date;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}
