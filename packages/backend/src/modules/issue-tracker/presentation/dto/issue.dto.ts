/**
 * RPT-260506 — Issue HTTP DTO + view mappers.
 * ADR-023: Request 는 snake_case, Response 는 camelCase.
 */
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  ISSUE_PRIORITY_VALUES,
  ISSUE_STATUS_VALUES,
  ISSUE_TYPE_VALUES,
  type IssueDto,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
  type KanbanIssuesDto,
} from '@a-idol/shared';
import type { IssueWithReporters } from '../../domain/issue';

const TYPE_VALUES: IssueType[] = [...ISSUE_TYPE_VALUES];
const STATUS_VALUES: IssueStatus[] = [...ISSUE_STATUS_VALUES];
const PRIORITY_VALUES: IssuePriority[] = [...ISSUE_PRIORITY_VALUES];

export class CreateIssueBody {
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(8000)
  description?: string | null;

  @IsOptional() @IsEnum(TYPE_VALUES)
  type?: IssueType;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: IssueStatus;

  @IsOptional() @IsEnum(PRIORITY_VALUES)
  priority?: IssuePriority;

  @IsOptional() @IsUUID()
  assignee_admin_id?: string | null;

  @IsOptional() @IsDateString()
  due_date?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  labels?: string | null;
}

export class UpdateIssueBody {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(8000)
  description?: string | null;

  @IsOptional() @IsEnum(TYPE_VALUES)
  type?: IssueType;

  @IsOptional() @IsEnum(STATUS_VALUES)
  status?: IssueStatus;

  @IsOptional() @IsEnum(PRIORITY_VALUES)
  priority?: IssuePriority;

  @IsOptional() @IsUUID()
  assignee_admin_id?: string | null;

  @IsOptional() @IsDateString()
  due_date?: string | null;

  @IsOptional() @IsString() @MaxLength(500)
  labels?: string | null;
}

export class MoveIssueBody {
  @IsEnum(STATUS_VALUES)
  to_status!: IssueStatus;

  @IsInt() @Min(0)
  to_index!: number;
}

export function toIssueDto(r: IssueWithReporters): IssueDto {
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    description: r.description,
    type: r.type,
    status: r.status,
    priority: r.priority,
    orderInColumn: r.orderInColumn,
    assigneeAdminId: r.assigneeAdminId,
    assigneeName: r.assigneeName,
    reporterAdminId: r.reporterAdminId,
    reporterName: r.reporterName,
    dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
    labels: r.labels,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const KANBAN_COLUMNS: IssueStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function toKanbanDto(rows: IssueWithReporters[]): KanbanIssuesDto {
  const grouped = new Map<IssueStatus, IssueDto[]>();
  for (const status of KANBAN_COLUMNS) grouped.set(status, []);
  for (const r of rows) {
    if (r.status === 'CANCELED') continue;
    const arr = grouped.get(r.status as IssueStatus);
    if (arr) arr.push(toIssueDto(r));
  }
  return {
    columns: KANBAN_COLUMNS.map((status) => ({
      status,
      issues: (grouped.get(status) ?? []).sort(
        (a, b) => a.orderInColumn - b.orderInColumn,
      ),
    })),
  };
}
