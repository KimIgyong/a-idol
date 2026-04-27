import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  ProjectDocCategory,
  ProjectDocDto,
  ProjectDocSourceType,
  ProjectDocStatus,
  ProjectDocSummaryDto,
} from '@a-idol/shared';
import type { ProjectDocRecord } from '../../application/interfaces';

const CATEGORY_VALUES: ProjectDocCategory[] = [
  'ADR',
  'DESIGN',
  'IMPLEMENTATION',
  'DELIVERABLE',
  'REPORT',
  'OPS',
  'OTHER',
];

const STATUS_VALUES: ProjectDocStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'];

const SOURCE_TYPE_VALUES: ProjectDocSourceType[] = ['FILE', 'INLINE'];

export class CreateProjectDocBody {
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  @Matches(/^[a-z0-9][a-z0-9-_/.]*$/i, {
    message: 'slug must be alphanumeric with - _ / . separators',
  })
  slug!: string;

  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsEnum(CATEGORY_VALUES)
  category!: ProjectDocCategory;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: ProjectDocStatus;

  @IsOptional() @IsEnum(SOURCE_TYPE_VALUES)
  sourceType?: ProjectDocSourceType;

  @IsOptional() @IsString() @MaxLength(500)
  sourcePath?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  summary?: string | null;

  @IsString() @MinLength(0) @MaxLength(500_000)
  content!: string;

  @IsOptional() @IsString() @MaxLength(500)
  tags?: string | null;

  @IsOptional() @IsInt() @Min(0)
  orderIndex?: number;
}

export class UpdateProjectDocBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160)
  @Matches(/^[a-z0-9][a-z0-9-_/.]*$/i)
  slug?: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsEnum(CATEGORY_VALUES)
  category?: ProjectDocCategory;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: ProjectDocStatus;

  @IsOptional() @IsEnum(SOURCE_TYPE_VALUES)
  sourceType?: ProjectDocSourceType;

  @IsOptional() @IsString() @MaxLength(500)
  sourcePath?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  summary?: string | null;

  @IsOptional() @IsString() @MaxLength(500_000)
  content?: string;

  @IsOptional() @IsString() @MaxLength(500)
  tags?: string | null;

  @IsOptional() @IsInt() @Min(0)
  orderIndex?: number;
}

export function toProjectDocSummaryDto(r: ProjectDocRecord): ProjectDocSummaryDto {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    category: r.category,
    status: r.status,
    sourceType: r.sourceType,
    sourcePath: r.sourcePath,
    summary: r.summary,
    tags: r.tags,
    orderIndex: r.orderIndex,
    version: r.version,
    updatedAt: r.updatedAt.toISOString(),
  };
}

export function toProjectDocDto(r: ProjectDocRecord): ProjectDocDto {
  return {
    ...toProjectDocSummaryDto(r),
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  };
}
