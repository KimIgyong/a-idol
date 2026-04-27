import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
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
import type { PaymentProvider, ProductKind } from '@a-idol/shared';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_KINDS: ProductKind[] = [
  'CHAT_COUPON',
  'VOTE_TICKET',
  'FAN_CLUB_SUBSCRIPTION',
  'PHOTOCARD_PACK',
];
const PAYMENT_PROVIDERS: PaymentProvider[] = [
  'DEV_SANDBOX',
  'APPLE_IAP',
  'GOOGLE_IAP',
  'STRIPE',
];

export class CreateProductBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  sku!: string;

  @ApiProperty({ enum: PRODUCT_KINDS })
  @IsIn(PRODUCT_KINDS)
  kind!: ProductKind;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  // ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0).
  @ApiProperty({ minimum: 0, name: 'price_krw' })
  @IsInt()
  @Min(0)
  price_krw!: number;

  @ApiProperty({ type: Object, name: 'delivery_payload' })
  @IsObject()
  delivery_payload!: Record<string, unknown>;
}

export class UpdateProductBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ minimum: 0, name: 'price_krw' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price_krw?: number;

  @ApiPropertyOptional({ type: Object, name: 'delivery_payload' })
  @IsOptional()
  @IsObject()
  delivery_payload?: Record<string, unknown>;

  @ApiPropertyOptional({ name: 'is_active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class CreatePurchaseBody {
  @ApiProperty({ name: 'product_id' })
  @IsString()
  @Matches(UUID_REGEX, { message: 'product_id must be a UUID' })
  product_id!: string;

  @ApiPropertyOptional({ enum: PAYMENT_PROVIDERS, default: 'DEV_SANDBOX' })
  @IsOptional()
  @IsIn(PAYMENT_PROVIDERS)
  provider?: PaymentProvider;

  @ApiPropertyOptional({ name: 'provider_tx_id' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  provider_tx_id?: string;

  // Apple StoreKit v2 compact JWS (ADR-019). Accepted but unused until
  // `JoseAppleReceiptVerifier` lands (Phase 1 W2 — awaiting `jose`
  // install approval). Keeping the field landed now lets the mobile
  // client ship its IAP integration ahead of server-side verify without
  // a later DTO change.
  @ApiPropertyOptional({
    description:
      'StoreKit v2 compact JWS. Required once APPLE_IAP goes live; ignored today.',
    name: 'receipt_jws',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8192)
  receipt_jws?: string;
}
