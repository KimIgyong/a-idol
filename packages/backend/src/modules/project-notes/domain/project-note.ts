import type { ProjectNoteCategory } from '@prisma/client';

export interface ProjectNoteRecord {
  id: string;
  title: string;
  body: string;
  category: ProjectNoteCategory;
  pinned: boolean;
  authorAdminId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectNoteWithAuthor extends ProjectNoteRecord {
  authorName: string | null;
}

export type { ProjectNoteCategory };
