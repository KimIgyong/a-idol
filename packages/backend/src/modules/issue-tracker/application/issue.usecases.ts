/**
 * RPT-260506 — Issue tracker use cases.
 * NotFoundException/BadRequestException 는 { code, message } shape 사용.
 */
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IssueWithReporters } from '../domain/issue';
import {
  ISSUE_REPOSITORY,
  type CreateIssueInput,
  type IssueRepository,
  type ListIssuesFilter,
  type MoveIssueInput,
  type UpdateIssueInput,
} from './interfaces';

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
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  async execute(input: CreateIssueInput): Promise<IssueWithReporters> {
    if (!input.title || input.title.trim().length === 0) {
      throw new BadRequestException({
        code: 'INVALID_TITLE',
        message: 'title is required',
      });
    }
    return this.repo.create(input);
  }
}

@Injectable()
export class UpdateIssueUseCase {
  constructor(@Inject(ISSUE_REPOSITORY) private readonly repo: IssueRepository) {}
  async execute(id: string, input: UpdateIssueInput): Promise<IssueWithReporters> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Issue ${id} not found`,
      });
    }
    return this.repo.update(id, input);
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
