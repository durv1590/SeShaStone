import { IsEnum, IsObject, IsOptional, IsString, Matches } from 'class-validator';
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
  @IsOptional() @IsString() reason?: string;
}
