import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { sanitizeRichHtml } from '../../../shared/security/sanitize-html';
import {
  ATTACHMENT_REPOSITORY,
  type AttachmentRepository,
} from '../../media/application/interfaces';
import type { ProjectNoteWithAuthor } from '../domain/project-note';
import {
  PROJECT_NOTE_REPOSITORY,
  type CreateNoteInput,
  type ListNotesFilter,
  type ProjectNoteRepository,
  type UpdateNoteInput,
} from './interfaces';

interface Actor {
  id: string;
  role: 'admin' | 'operator' | 'viewer';
}

function assertAuthorOrAdmin(actor: Actor, note: ProjectNoteWithAuthor): void {
  if (actor.role === 'admin') return;
  if (note.authorAdminId === actor.id) return;
  throw new DomainError(ErrorCodes.NOTE_FORBIDDEN, '이 노트를 수정할 권한이 없습니다.');
}

@Injectable()
export class ListProjectNotesUseCase {
  constructor(@Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository) {}
  execute(filter?: ListNotesFilter): Promise<ProjectNoteWithAuthor[]> {
    return this.repo.list(filter);
  }
}

@Injectable()
export class GetProjectNoteUseCase {
  constructor(@Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository) {}
  async execute(id: string): Promise<ProjectNoteWithAuthor> {
    const note = await this.repo.findById(id);
    if (!note) throw new DomainError(ErrorCodes.NOTE_NOT_FOUND, '노트를 찾을 수 없습니다.');
    return note;
  }
}

export interface CreateProjectNoteCommand extends Omit<CreateNoteInput, 'body'> {
  body: string;
  attachmentIds?: string[];
}

@Injectable()
export class CreateProjectNoteUseCase {
  private readonly log = new Logger(CreateProjectNoteUseCase.name);

  constructor(
    @Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository,
    @Optional() @Inject(ATTACHMENT_REPOSITORY) private readonly attachments?: AttachmentRepository,
  ) {}

  async execute(input: CreateProjectNoteCommand): Promise<ProjectNoteWithAuthor> {
    const created = await this.repo.create({
      title: input.title,
      body: sanitizeRichHtml(input.body),
      category: input.category,
      pinned: input.pinned,
      authorAdminId: input.authorAdminId,
    });
    if (input.attachmentIds?.length && this.attachments) {
      await this.attachments.linkToOwner(input.attachmentIds, 'NOTE', created.id);
    }
    this.log.log(`note.create id=${created.id} author=${input.authorAdminId} category=${created.category}`);
    return created;
  }
}

export interface UpdateProjectNoteCommand extends UpdateNoteInput {
  attachmentIds?: string[];
}

@Injectable()
export class UpdateProjectNoteUseCase {
  private readonly log = new Logger(UpdateProjectNoteUseCase.name);

  constructor(
    @Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository,
    @Optional() @Inject(ATTACHMENT_REPOSITORY) private readonly attachments?: AttachmentRepository,
  ) {}

  async execute(actor: Actor, id: string, input: UpdateProjectNoteCommand): Promise<ProjectNoteWithAuthor> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainError(ErrorCodes.NOTE_NOT_FOUND, '노트를 찾을 수 없습니다.');
    assertAuthorOrAdmin(actor, existing);
    const updated = await this.repo.update(id, {
      title: input.title,
      body: input.body !== undefined ? sanitizeRichHtml(input.body) : undefined,
      category: input.category,
      pinned: input.pinned,
    });
    if (!updated) throw new DomainError(ErrorCodes.NOTE_NOT_FOUND, '노트를 찾을 수 없습니다.');
    if (input.attachmentIds?.length && this.attachments) {
      await this.attachments.linkToOwner(input.attachmentIds, 'NOTE', id);
    }
    this.log.log(`note.update id=${id} actor=${actor.id}`);
    return updated;
  }
}

@Injectable()
export class DeleteProjectNoteUseCase {
  private readonly log = new Logger(DeleteProjectNoteUseCase.name);

  constructor(@Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository) {}

  async execute(actor: Actor, id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainError(ErrorCodes.NOTE_NOT_FOUND, '노트를 찾을 수 없습니다.');
    assertAuthorOrAdmin(actor, existing);
    await this.repo.remove(id);
    this.log.log(`note.delete id=${id} actor=${actor.id}`);
  }
}

@Injectable()
export class TogglePinProjectNoteUseCase {
  constructor(@Inject(PROJECT_NOTE_REPOSITORY) private readonly repo: ProjectNoteRepository) {}
  async execute(id: string, pinned: boolean): Promise<ProjectNoteWithAuthor> {
    const updated = await this.repo.update(id, { pinned });
    if (!updated) throw new DomainError(ErrorCodes.NOTE_NOT_FOUND, '노트를 찾을 수 없습니다.');
    return updated;
  }
}
