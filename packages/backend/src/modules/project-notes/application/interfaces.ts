import type { ProjectNoteCategory } from '@prisma/client';
import type { ProjectNoteWithAuthor } from '../domain/project-note';

export interface ListNotesFilter {
  category?: ProjectNoteCategory;
  pinnedOnly?: boolean;
  q?: string;
}

export interface CreateNoteInput {
  title: string;
  body: string;
  category?: ProjectNoteCategory;
  pinned?: boolean;
  authorAdminId: string;
}

export interface UpdateNoteInput {
  title?: string;
  body?: string;
  category?: ProjectNoteCategory;
  pinned?: boolean;
}

export interface ProjectNoteRepository {
  list(filter?: ListNotesFilter): Promise<ProjectNoteWithAuthor[]>;
  findById(id: string): Promise<ProjectNoteWithAuthor | null>;
  create(input: CreateNoteInput): Promise<ProjectNoteWithAuthor>;
  update(id: string, input: UpdateNoteInput): Promise<ProjectNoteWithAuthor | null>;
  remove(id: string): Promise<void>;
}

export const PROJECT_NOTE_REPOSITORY = 'ProjectNoteRepository';
