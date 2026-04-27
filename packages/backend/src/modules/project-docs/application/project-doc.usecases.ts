import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateProjectDocInput,
  ListProjectDocsFilter,
  ProjectDocRecord,
  ProjectDocRepository,
  UpdateProjectDocInput,
} from './interfaces';
import { PROJECT_DOC_REPOSITORY } from './interfaces';

@Injectable()
export class ListProjectDocsUseCase {
  constructor(@Inject(PROJECT_DOC_REPOSITORY) private readonly repo: ProjectDocRepository) {}
  execute(filter?: ListProjectDocsFilter): Promise<ProjectDocRecord[]> {
    return this.repo.list(filter);
  }
}

@Injectable()
export class GetProjectDocUseCase {
  constructor(@Inject(PROJECT_DOC_REPOSITORY) private readonly repo: ProjectDocRepository) {}
  async execute(slug: string): Promise<ProjectDocRecord> {
    const doc = await this.repo.findBySlug(slug);
    if (!doc) throw new NotFoundException({ code: 'NOT_FOUND', message: `ProjectDoc ${slug} not found` });
    return doc;
  }
}

@Injectable()
export class CreateProjectDocUseCase {
  constructor(@Inject(PROJECT_DOC_REPOSITORY) private readonly repo: ProjectDocRepository) {}
  async execute(input: CreateProjectDocInput): Promise<ProjectDocRecord> {
    const dup = await this.repo.findBySlug(input.slug);
    if (dup) {
      throw new ConflictException({
        code: 'SLUG_DUPLICATE',
        message: `ProjectDoc slug "${input.slug}" already exists`,
      });
    }
    return this.repo.create(input);
  }
}

@Injectable()
export class UpdateProjectDocUseCase {
  constructor(@Inject(PROJECT_DOC_REPOSITORY) private readonly repo: ProjectDocRepository) {}
  async execute(id: string, input: UpdateProjectDocInput): Promise<ProjectDocRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: `ProjectDoc ${id} not found` });
    }
    if (input.slug && input.slug !== existing.slug) {
      const dup = await this.repo.findBySlug(input.slug);
      if (dup) {
        throw new ConflictException({
          code: 'SLUG_DUPLICATE',
          message: `ProjectDoc slug "${input.slug}" already exists`,
        });
      }
    }
    return this.repo.update(id, input);
  }
}

@Injectable()
export class DeleteProjectDocUseCase {
  constructor(@Inject(PROJECT_DOC_REPOSITORY) private readonly repo: ProjectDocRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: `ProjectDoc ${id} not found` });
    }
    await this.repo.remove(id);
  }
}
