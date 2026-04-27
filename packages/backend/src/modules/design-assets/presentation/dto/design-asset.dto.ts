import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  DesignAssetDto,
  DesignAssetPlatform,
  DesignAssetStatus,
  DesignAssetType,
} from '@a-idol/shared';
import type { DesignAssetRecord } from '../../application/interfaces';

const TYPE_VALUES: DesignAssetType[] = [
  'APP_ICON',
  'SCREENSHOT',
  'FEATURE_GRAPHIC',
  'SPLASH',
  'PREVIEW_VIDEO',
  'PERSONA_IMAGE',
  'PHOTOCARD_ART',
  'OTHER',
];

const PLATFORM_VALUES: DesignAssetPlatform[] = ['IOS', 'ANDROID', 'WEB', 'ALL'];

const STATUS_VALUES: DesignAssetStatus[] = [
  'PLACEHOLDER',
  'DRAFT',
  'APPROVED',
  'LEGAL_REVIEWED',
  'SHIPPED',
];

export class CreateDesignAssetBody {
  @IsString() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsEnum(TYPE_VALUES)
  type!: DesignAssetType;

  @IsOptional() @IsEnum(PLATFORM_VALUES)
  platform?: DesignAssetPlatform;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: DesignAssetStatus;

  @IsOptional() @IsUrl() @MaxLength(500)
  fileUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  spec?: string | null;

  @IsOptional() @IsInt() @Min(0)
  orderIndex?: number;

  @IsOptional() @IsString() @MaxLength(200)
  caption?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string | null;
}

export class UpdateDesignAssetBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @IsOptional() @IsEnum(TYPE_VALUES)
  type?: DesignAssetType;

  @IsOptional() @IsEnum(PLATFORM_VALUES)
  platform?: DesignAssetPlatform;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: DesignAssetStatus;

  @IsOptional() @IsUrl() @MaxLength(500)
  fileUrl?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  spec?: string | null;

  @IsOptional() @IsInt() @Min(0)
  orderIndex?: number;

  @IsOptional() @IsString() @MaxLength(200)
  caption?: string | null;

  @IsOptional() @IsString() @MaxLength(2000)
  notes?: string | null;
}

export function toDesignAssetDto(r: DesignAssetRecord): DesignAssetDto {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    platform: r.platform,
    status: r.status,
    fileUrl: r.fileUrl,
    spec: r.spec,
    orderIndex: r.orderIndex,
    caption: r.caption,
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
