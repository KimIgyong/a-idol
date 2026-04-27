import type {
  ProjectDocCategory,
  ProjectDocSourceType,
  ProjectDocStatus,
} from '@a-idol/shared';

export interface ProjectDocRecord {
  id: string;
  slug: string;
  title: string;
  category: ProjectDocCategory;
  status: ProjectDocStatus;
  sourceType: ProjectDocSourceType;
  sourcePath: string | null;
  summary: string | null;
  content: string;
  tags: string | null;
  orderIndex: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ListProjectDocsFilter {
  category?: ProjectDocCategory;
  status?: ProjectDocStatus;
}

export interface CreateProjectDocInput {
  slug: string;
  title: string;
  category: ProjectDocCategory;
  status?: ProjectDocStatus;
  sourceType?: ProjectDocSourceType;
  sourcePath?: string | null;
  summary?: string | null;
  content: string;
  tags?: string | null;
  orderIndex?: number;
  createdBy: string;
}

export interface UpdateProjectDocInput {
  slug?: string;
  title?: string;
  category?: ProjectDocCategory;
  status?: ProjectDocStatus;
  sourceType?: ProjectDocSourceType;
  sourcePath?: string | null;
  summary?: string | null;
  content?: string;
  tags?: string | null;
  orderIndex?: number;
  updatedBy: string;
}

export interface ProjectDocRepository {
  list(filter?: ListProjectDocsFilter): Promise<ProjectDocRecord[]>;
  findBySlug(slug: string): Promise<ProjectDocRecord | null>;
  findById(id: string): Promise<ProjectDocRecord | null>;
  create(input: CreateProjectDocInput): Promise<ProjectDocRecord>;
  update(id: string, input: UpdateProjectDocInput): Promise<ProjectDocRecord>;
  remove(id: string): Promise<void>;
}

export const PROJECT_DOC_REPOSITORY = 'ProjectDocRepository';
