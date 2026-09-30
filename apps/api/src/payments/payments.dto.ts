import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto/pagination.dto';

export class InitiatePaymentDto {
  @IsString() orderId: string;
  /** RAZORPAY, CASHFREE, or UPI (UPI is routed through the default gateway). */
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
}

export class VerifyPaymentDto {
  @IsString() paymentId: string;
  /** Gateway callback fields, e.g. razorpay_payment_id + razorpay_signature. */
  @IsObject() payload: Record<string, string>;
}

export class ListPaymentsDto extends PaginationDto {
  @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider;
}

export class SubmitPaymentReferenceDto {
  /** UPI transaction ID / bank UTR (usually 12–22 letters and digits). */
  @Matches(/^[A-Za-z0-9]{6,30}$/, { message: 'Enter the UTR / transaction reference shown in your app' })
  reference: string;
}

export class RejectPaymentDto {
  @IsString() @MinLength(3) @MaxLength(300) reason: string;
}

export class CreateRefundDto {
  /** Paise. */
  @IsInt() @Min(1) amount: number;
  @IsString() @MinLength(3) @MaxLength(300) reason: string;
  @IsOptional() @IsIn(['upi', 'bank_transfer', 'original_method', 'cash']) method?: string;
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  /** Record as already paid out (with reference) instead of pending. */
  @IsOptional() @IsBoolean() processed?: boolean;
}

export class UpdateRefundDto {
  @IsIn(['PROCESSED', 'FAILED']) status: 'PROCESSED' | 'FAILED';
  @IsOptional() @IsString() @MaxLength(60) reference?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class ListRefundsDto extends PaginationDto {
  @IsOptional() @IsIn(['PENDING', 'PROCESSED', 'FAILED']) status?: 'PENDING' | 'PROCESSED' | 'FAILED';
}
