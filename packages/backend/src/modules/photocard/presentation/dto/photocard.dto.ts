import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { PhotocardRarity } from '@a-idol/shared';

// ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RARITIES: PhotocardRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

export class CreatePhotocardSetBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ name: 'idol_id' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'idol_id must be a UUID' })
  idol_id?: string;
}

export class UpdatePhotocardSetBody {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ name: 'idol_id' })
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'idol_id must be a UUID' })
  idol_id?: string | null;

  @ApiPropertyOptional({ name: 'is_active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class AddPhotocardTemplateBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ name: 'image_url' })
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  image_url?: string;

  @ApiPropertyOptional({ enum: RARITIES })
  @IsOptional()
  @IsIn(RARITIES)
  rarity?: PhotocardRarity;

  @ApiPropertyOptional({ minimum: 1, name: 'drop_weight' })
  @IsOptional()
  @IsInt()
  @Min(1)
  drop_weight?: number;
}
