import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import type { ProjectNoteCategory } from '@prisma/client';
import type { ProjectNoteWithAuthor } from '../../domain/project-note';

const CATEGORY_VALUES: ProjectNoteCategory[] = ['NOTE', 'MEETING', 'DECISION', 'LINK', 'OTHER'];

export class CreateProjectNoteBody {
  @ApiProperty({ example: 'DTO snake_case 마이그레이션 합의' })
  @IsString() @Length(1, 120)
  title!: string;

  @ApiProperty({ example: '<p>본문 ...</p>', description: 'sanitize-html 화이트리스트 통과 HTML' })
  @IsString() @MaxLength(50000)
  body!: string;

  @ApiProperty({ enum: CATEGORY_VALUES, example: 'NOTE', required: false })
  @IsOptional() @IsIn(CATEGORY_VALUES)
  category?: ProjectNoteCategory;

  @ApiProperty({ example: false, required: false })
  @IsOptional() @IsBoolean()
  pinned?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true })
  attachment_ids?: string[];
}

export class UpdateProjectNoteBody {
  @IsOptional() @IsString() @Length(1, 120)
  title?: string;

  @IsOptional() @IsString() @MaxLength(50000)
  body?: string;

  @IsOptional() @IsIn(CATEGORY_VALUES)
  category?: ProjectNoteCategory;

  @IsOptional() @IsBoolean()
  pinned?: boolean;

  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true })
  attachment_ids?: string[];
}

export class TogglePinBody {
  @IsBoolean()
  pinned!: boolean;
}

export interface ProjectNoteDto {
  id: string;
  title: string;
  body: string;
  category: ProjectNoteCategory;
  pinned: boolean;
  authorAdminId: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toProjectNoteDto(r: ProjectNoteWithAuthor): ProjectNoteDto {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    category: r.category,
    pinned: r.pinned,
    authorAdminId: r.authorAdminId,
    authorName: r.authorName,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
