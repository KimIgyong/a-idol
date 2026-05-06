/**
 * RPT-260506 — Issue tracker domain entity (shared types).
 * Backend domain layer 와 CMS UI 가 동일한 타입을 import.
 */

export type IssueType = 'TASK' | 'BUG' | 'STORY' | 'RISK';
export type IssueStatus =
  | 'BACKLOG'
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'DONE'
  | 'CANCELED';
export type IssuePriority = 'P0' | 'P1' | 'P2' | 'P3';

export const ISSUE_TYPE_VALUES: readonly IssueType[] = [
  'TASK',
  'BUG',
  'STORY',
  'RISK',
];
export const ISSUE_STATUS_VALUES: readonly IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
  'CANCELED',
];
export const ISSUE_PRIORITY_VALUES: readonly IssuePriority[] = [
  'P0',
  'P1',
  'P2',
  'P3',
];

/** Kanban 화면 컬럼 순서 (CANCELED 는 컬럼 표시 X — 필터/리스트에서만 노출). */
export const ISSUE_KANBAN_COLUMNS: readonly IssueStatus[] = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'DONE',
];
