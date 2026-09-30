import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';
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
