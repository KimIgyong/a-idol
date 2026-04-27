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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'idolId must be a UUID' })
  idolId?: string;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX, { message: 'idolId must be a UUID' })
  idolId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddPhotocardTemplateBody {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false, require_protocol: false })
  imageUrl?: string;

  @ApiPropertyOptional({ enum: RARITIES })
  @IsOptional()
  @IsIn(RARITIES)
  rarity?: PhotocardRarity;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  dropWeight?: number;
}
