import { Injectable } from '@nestjs/common';
import type {
  ProjectDocCategory,
  ProjectDocSourceType,
  ProjectDocStatus,
} from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  CreateProjectDocInput,
  ListProjectDocsFilter,
  ProjectDocRecord,
  ProjectDocRepository,
  UpdateProjectDocInput,
} from '../application/interfaces';

@Injectable()
export class PrismaProjectDocRepository implements ProjectDocRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: ListProjectDocsFilter): Promise<ProjectDocRecord[]> {
    const rows = await this.prisma.projectDocument.findMany({
      where: {
        category: filter?.category,
        status: filter?.status,
      },
      orderBy: [{ category: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'desc' }],
    });
    return rows.map(toRecord);
  }

  async findBySlug(slug: string): Promise<ProjectDocRecord | null> {
    const row = await this.prisma.projectDocument.findUnique({ where: { slug } });
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<ProjectDocRecord | null> {
    const row = await this.prisma.projectDocument.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateProjectDocInput): Promise<ProjectDocRecord> {
    const row = await this.prisma.projectDocument.create({
      data: {
        slug: input.slug,
        title: input.title,
        category: input.category,
        status: input.status ?? 'DRAFT',
        sourceType: input.sourceType ?? 'INLINE',
        sourcePath: input.sourcePath ?? null,
        summary: input.summary ?? null,
        content: input.content,
        tags: input.tags ?? null,
        orderIndex: input.orderIndex ?? 0,
        version: 1,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
      },
    });
    return toRecord(row);
  }

  async update(id: string, input: UpdateProjectDocInput): Promise<ProjectDocRecord> {
    const data: Record<string, unknown> = {
      slug: input.slug,
      title: input.title,
      category: input.category,
      status: input.status,
      sourceType: input.sourceType,
      sourcePath: input.sourcePath,
      summary: input.summary,
      tags: input.tags,
      orderIndex: input.orderIndex,
      updatedBy: input.updatedBy,
    };
    if (input.content !== undefined) {
      data.content = input.content;
      data.version = { increment: 1 };
    }
    const row = await this.prisma.projectDocument.update({ where: { id }, data });
    return toRecord(row);
  }

  async remove(id: string): Promise<void> {
    await this.prisma.projectDocument.delete({ where: { id } });
  }
}

function toRecord(row: {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  sourceType: string;
  sourcePath: string | null;
  summary: string | null;
  content: string;
  tags: string | null;
  orderIndex: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): ProjectDocRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category as ProjectDocCategory,
    status: row.status as ProjectDocStatus,
    sourceType: row.sourceType as ProjectDocSourceType,
    sourcePath: row.sourcePath,
    summary: row.summary,
    content: row.content,
    tags: row.tags,
    orderIndex: row.orderIndex,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
