import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
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

// Accept any UUID-shaped string (any version, incl. seed ids whose
// version bits are 0). Existence is checked in the usecase layer.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateAgencyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateAgencyDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateIdolDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  stageName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  mbti?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2002-05-14' })
  @IsOptional()
  @IsISO8601()
  birthdate?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'agencyId must be a UUID' })
  agencyId?: string;
}

export class CreateIdolDto {
  @ApiProperty()
  @IsString()
  @Matches(UUID_REGEX, { message: 'agencyId must be a UUID' })
  agencyId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  stageName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4)
  mbti?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  heroImageUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2002-05-14' })
  @IsOptional()
  @IsISO8601()
  birthdate?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  publishImmediately?: boolean;
}

export const SCHEDULE_TYPES = ['BROADCAST', 'CONCERT', 'FANMEETING', 'STREAMING', 'OTHER'] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export class CreateScheduleDto {
  @ApiPropertyOptional({ enum: SCHEDULE_TYPES, default: 'OTHER' })
  @IsOptional()
  @IsEnum(SCHEDULE_TYPES)
  type?: ScheduleType;

  @ApiProperty({ example: 'M!Countdown 스페셜 MC' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @ApiProperty({ example: '2026-04-24T17:00:00Z' })
  @IsISO8601()
  startAt!: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-04-24T18:30:00Z' })
  @IsOptional()
  @IsISO8601()
  endAt?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class ListAdminIdolsQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  size: number = 50;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeDeleted: boolean = false;
}
