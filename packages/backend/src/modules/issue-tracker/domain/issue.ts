/**
 * RPT-260506 — Issue tracker domain types (backend internal).
 */
import type { IssuePriority, IssueStatus, IssueType } from '@a-idol/shared';

export interface IssueRecord {
  id: string;
  key: string;
  title: string;
  description: string | null;
  type: IssueType;
  status: IssueStatus;
  priority: IssuePriority;
  orderInColumn: number;
  assigneeAdminId: string | null;
  reporterAdminId: string | null;
  startAt: Date | null;
  dueDate: Date | null;
  labels: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IssueWithReporters extends IssueRecord {
  assigneeName: string | null;
  reporterName: string | null;
}
