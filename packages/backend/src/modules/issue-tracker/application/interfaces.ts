/**
 * RPT-260506 — Issue repository port.
 * Application layer 가 의존하는 인터페이스. infrastructure 가 Prisma 로 구현.
 */
import type { IssuePriority, IssueStatus, IssueType } from '@a-idol/shared';
import type { IssueWithReporters } from '../domain/issue';

export interface ListIssuesFilter {
  status?: IssueStatus;
  type?: IssueType;
  priority?: IssuePriority;
  assigneeAdminId?: string;
  q?: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string | null;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeAdminId?: string | null;
  reporterAdminId: string;
  dueDate?: string | null;
  labels?: string | null;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string | null;
  type?: IssueType;
  status?: IssueStatus;
  priority?: IssuePriority;
  assigneeAdminId?: string | null;
  dueDate?: string | null;
  labels?: string | null;
}

export interface MoveIssueInput {
  toStatus: IssueStatus;
  toIndex: number;
}

export interface IssueRepository {
  list(filter?: ListIssuesFilter): Promise<IssueWithReporters[]>;
  findById(id: string): Promise<IssueWithReporters | null>;
  findByKey(key: string): Promise<IssueWithReporters | null>;
  create(input: CreateIssueInput): Promise<IssueWithReporters>;
  update(id: string, input: UpdateIssueInput): Promise<IssueWithReporters>;
  move(id: string, input: MoveIssueInput): Promise<IssueWithReporters>;
  remove(id: string): Promise<void>;
}

export const ISSUE_REPOSITORY = 'IssueRepository';
