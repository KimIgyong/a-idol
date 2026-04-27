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

  @ApiProperty({ example: '2026-07-01T00:00:00Z' })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: '2026-08-29T00:00:00Z' })
  @IsISO8601()
  endAt!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(UUID_REGEX, { each: true, message: 'each idolId must be a UUID' })
  idolIds?: string[];
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endAt?: string;
}

export class AddEntriesBody {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(UUID_REGEX, { each: true })
  idolIds!: string[];
}

export class CreateRoundBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  orderIndex!: number;

  @ApiProperty({ example: '2026-07-10T00:00:00Z' })
  @IsISO8601()
  startAt!: string;

  @ApiProperty({ example: '2026-07-17T00:00:00Z' })
  @IsISO8601()
  endAt!: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  maxAdvancers?: number | null;
}

export class UpdateRoundBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderIndex?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endAt?: string;

  @ApiPropertyOptional({ nullable: true, minimum: 1, maximum: 99 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  maxAdvancers?: number | null;
}

export class UpsertVoteRuleBody {
  @ApiProperty({ example: 1.0, minimum: 0 })
  @IsInt({ message: 'heartWeight must be an integer (or use fractional weights per your policy)' })
  @Min(0)
  heartWeight!: number;

  @ApiProperty({ example: 0, minimum: 0 })
  @IsInt()
  @Min(0)
  smsWeight!: number;

  @ApiProperty({ example: 10, minimum: 0 })
  @IsInt()
  @Min(0)
  ticketWeight!: number;

  @ApiPropertyOptional({ example: 1, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  dailyHeartLimit?: number;
}
