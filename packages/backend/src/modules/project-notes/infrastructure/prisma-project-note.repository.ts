import { Injectable } from '@nestjs/common';
import type { Prisma, ProjectNoteCategory } from '@prisma/client';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { ProjectNoteWithAuthor } from '../domain/project-note';
import type {
  CreateNoteInput,
  ListNotesFilter,
  ProjectNoteRepository,
  UpdateNoteInput,
} from '../application/interfaces';

type NoteRow = {
  id: string;
  title: string;
  body: string;
  category: ProjectNoteCategory;
  pinned: boolean;
  authorAdminId: string;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaProjectNoteRepository implements ProjectNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: ListNotesFilter): Promise<ProjectNoteWithAuthor[]> {
    const where: Prisma.ProjectNoteWhereInput = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.pinnedOnly) where.pinned = true;
    if (filter?.q && filter.q.trim().length > 0) {
      where.OR = [
        { title: { contains: filter.q.trim(), mode: 'insensitive' } },
        { body: { contains: filter.q.trim(), mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.projectNote.findMany({
      where,
      orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    });
    return this.attachAuthors(rows);
  }

  async findById(id: string): Promise<ProjectNoteWithAuthor | null> {
    const row = await this.prisma.projectNote.findUnique({ where: { id } });
    if (!row) return null;
    const [withAuthor] = await this.attachAuthors([row]);
    return withAuthor;
  }

  async create(input: CreateNoteInput): Promise<ProjectNoteWithAuthor> {
    const row = await this.prisma.projectNote.create({
      data: {
        title: input.title,
        body: input.body,
        category: input.category ?? 'NOTE',
        pinned: input.pinned ?? false,
        authorAdminId: input.authorAdminId,
      },
    });
    const [withAuthor] = await this.attachAuthors([row]);
    return withAuthor;
  }

  async update(id: string, input: UpdateNoteInput): Promise<ProjectNoteWithAuthor | null> {
    try {
      const row = await this.prisma.projectNote.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
        },
      });
      const [withAuthor] = await this.attachAuthors([row]);
      return withAuthor;
    } catch (err) {
      if ((err as { code?: string }).code === 'P2025') return null;
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    await this.prisma.projectNote.delete({ where: { id } });
  }

  private async attachAuthors(rows: NoteRow[]): Promise<ProjectNoteWithAuthor[]> {
    const ids = Array.from(new Set(rows.map((r) => r.authorAdminId)));
    let nameMap = new Map<string, string>();
    if (ids.length > 0) {
      const admins = await this.prisma.adminUser.findMany({
        where: { id: { in: ids } },
        select: { id: true, displayName: true },
      });
      nameMap = new Map(admins.map((a) => [a.id, a.displayName]));
    }
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      category: r.category,
      pinned: r.pinned,
      authorAdminId: r.authorAdminId,
      authorName: nameMap.get(r.authorAdminId) ?? null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
