import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

// ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateAuditionBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiProperty({ example: '2026-07-01T00:00:00Z', name: 'start_at' })
  @IsISO8601()
  start_at!: string;

  @ApiProperty({ example: '2026-08-29T00:00:00Z', name: 'end_at' })
  @IsISO8601()
  end_at!: string;

  @ApiPropertyOptional({ type: [String], name: 'idol_ids' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(UUID_REGEX, { each: true, message: 'each idol_id must be a UUID' })
  idol_ids?: string[];
}

export class UpdateAuditionBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ name: 'start_at' })
  @IsOptional()
  @IsISO8601()
  start_at?: string;

  @ApiPropertyOptional({ name: 'end_at' })
  @IsOptional()
  @IsISO8601()
  end_at?: string;
}

export class AddEntriesBody {
  @ApiProperty({ type: [String], name: 'idol_ids' })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(UUID_REGEX, { each: true })
  idol_ids!: string[];
}

export class CreateRoundBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ minimum: 1, name: 'order_index' })
  @IsInt()
  @Min(1)
  order_index!: number;

  @ApiProperty({ example: '2026-07-10T00:00:00Z', name: 'start_at' })
  @IsISO8601()
  start_at!: string;

  @ApiProperty({ example: '2026-07-17T00:00:00Z', name: 'end_at' })
  @IsISO8601()
  end_at!: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 99, name: 'max_advancers' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  max_advancers?: number | null;
}

export class UpdateRoundBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minimum: 1, name: 'order_index' })
  @IsOptional()
  @IsInt()
  @Min(1)
  order_index?: number;

  @ApiPropertyOptional({ name: 'start_at' })
  @IsOptional()
  @IsISO8601()
  start_at?: string;

  @ApiPropertyOptional({ name: 'end_at' })
  @IsOptional()
  @IsISO8601()
  end_at?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 99, name: 'max_advancers' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  max_advancers?: number | null;
}

export class UpsertVoteRuleBody {
  @ApiProperty({ example: 1.0, minimum: 0, name: 'heart_weight' })
  @IsInt({ message: 'heart_weight must be an integer (or use fractional weights per your policy)' })
  @Min(0)
  heart_weight!: number;

  @ApiProperty({ example: 0, minimum: 0, name: 'sms_weight' })
  @IsInt()
  @Min(0)
  sms_weight!: number;

  @ApiProperty({ example: 10, minimum: 0, name: 'ticket_weight' })
  @IsInt()
  @Min(0)
  ticket_weight!: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 100, name: 'daily_heart_limit' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  daily_heart_limit?: number;
}
