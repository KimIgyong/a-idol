/**
 * RPT-260506 — Issue tracker use cases.
 * NotFoundException/BadRequestException 는 { code, message } shape 사용.
 */
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import { sanitizeRichHtml } from '../../../shared/security/sanitize-html';
import {
  ATTACHMENT_REPOSITORY,
  type AttachmentRepository,
} from '../../media/application/interfaces';
import type { IssueWithReporters } from '../domain/issue';
import {
  ISSUE_REPOSITORY,
  type CreateIssueInput,
  type IssueRepository,
  type ListIssuesFilter,
  type MoveIssueInput,
  type UpdateIssueInput,
} from './interfaces';

function assertDateRange(startAt?: string | null, dueDate?: string | null): void {
  if (!startAt || !dueDate) return;
  if (new Date(startAt).getTime() > new Date(dueDate).getTime()) {
    throw new DomainError(
      ErrorCodes.ISSUE_INVALID_DATE_RANGE,
      '시작일이 마감일보다 늦을 수 없습니다.',
    );
  }
}

@Injectable()
export class ListIssuesUseCase {
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  execute(filter?: ListIssuesFilter): Promise<IssueWithReporters[]> {
    return this.repo.list(filter);
  }
}

@Injectable()
export class GetIssueUseCase {
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  async execute(idOrKey: string): Promise<IssueWithReporters> {
    const isKey = idOrKey.startsWith('IIS-');
    const found = isKey
      ? await this.repo.findByKey(idOrKey)
      : await this.repo.findById(idOrKey);
    if (!found) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Issue ${idOrKey} not found`,
      });
    }
    return found;
  }
}

@Injectable()
export class CreateIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
    @Optional() @Inject(ATTACHMENT_REPOSITORY) private readonly attachments?: AttachmentRepository,
  ) {}
  async execute(input: CreateIssueInput): Promise<IssueWithReporters> {
    if (!input.title || input.title.trim().length === 0) {
      throw new BadRequestException({
        code: 'INVALID_TITLE',
        message: 'title is required',
      });
    }
    assertDateRange(input.startAt, input.dueDate);
    const sanitized = {
      ...input,
      description: input.description != null ? sanitizeRichHtml(input.description) : input.description,
    };
    const created = await this.repo.create(sanitized);
    if (input.attachmentIds?.length && this.attachments) {
      await this.attachments.linkToOwner(input.attachmentIds, 'ISSUE', created.id);
    }
    return created;
  }
}

@Injectable()
export class UpdateIssueUseCase {
  constructor(
    @Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository,
    @Optional() @Inject(ATTACHMENT_REPOSITORY) private readonly attachments?: AttachmentRepository,
  ) {}
  async execute(id: string, input: UpdateIssueInput): Promise<IssueWithReporters> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Issue ${id} not found`,
      });
    }
    const nextStart =
      input.startAt !== undefined
        ? input.startAt
        : existing.startAt
          ? existing.startAt.toISOString().slice(0, 10)
          : null;
    const nextDue =
      input.dueDate !== undefined
        ? input.dueDate
        : existing.dueDate
          ? existing.dueDate.toISOString().slice(0, 10)
          : null;
    assertDateRange(nextStart, nextDue);
    const sanitized = {
      ...input,
      description:
        input.description !== undefined && input.description !== null
          ? sanitizeRichHtml(input.description)
          : input.description,
    };
    const updated = await this.repo.update(id, sanitized);
    if (input.attachmentIds?.length && this.attachments) {
      await this.attachments.linkToOwner(input.attachmentIds, 'ISSUE', id);
    }
    return updated;
  }
}

@Injectable()
export class MoveIssueUseCase {
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  async execute(id: string, input: MoveIssueInput): Promise<IssueWithReporters> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Issue ${id} not found`,
      });
    }
    if (input.toIndex < 0) {
      throw new BadRequestException({
        code: 'INVALID_INDEX',
        message: 'to_index must be >= 0',
      });
    }
    return this.repo.move(id, input);
  }
}

@Injectable()
export class DeleteIssueUseCase {
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Issue ${id} not found`,
      });
    }
    await this.repo.remove(id);
  }
}
