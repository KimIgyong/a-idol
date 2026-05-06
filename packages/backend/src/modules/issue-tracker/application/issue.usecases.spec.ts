/**
 * RPT-260506 — Issue use cases unit tests (fake repository).
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CreateIssueUseCase,
  DeleteIssueUseCase,
  GetIssueUseCase,
  ListIssuesUseCase,
  MoveIssueUseCase,
  UpdateIssueUseCase,
} from './issue.usecases';
import type {
  CreateIssueInput,
  IssueRepository,
  ListIssuesFilter,
  MoveIssueInput,
  UpdateIssueInput,
} from './interfaces';
import type { IssueWithReporters } from '../domain/issue';

function makeRow(over: Partial<IssueWithReporters> = {}): IssueWithReporters {
  return {
    id: over.id ?? 'id-1',
    key: over.key ?? 'IIS-1',
    title: over.title ?? 'Test',
    description: over.description ?? null,
    type: over.type ?? 'TASK',
    status: over.status ?? 'BACKLOG',
    priority: over.priority ?? 'P2',
    orderInColumn: over.orderInColumn ?? 0,
    assigneeAdminId: over.assigneeAdminId ?? null,
    assigneeName: over.assigneeName ?? null,
    reporterAdminId: over.reporterAdminId ?? 'rep-1',
    reporterName: over.reporterName ?? 'Reporter',
    startAt: over.startAt ?? null,
    dueDate: over.dueDate ?? null,
    labels: over.labels ?? null,
    createdAt: over.createdAt ?? new Date('2026-05-06T00:00:00Z'),
    updatedAt: over.updatedAt ?? new Date('2026-05-06T00:00:00Z'),
  };
}

class FakeRepo implements IssueRepository {
  rows = new Map<string, IssueWithReporters>();
  async list(_f?: ListIssuesFilter) {
    return Array.from(this.rows.values());
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByKey(key: string) {
    return Array.from(this.rows.values()).find((r) => r.key === key) ?? null;
  }
  async create(input: CreateIssueInput) {
    const row = makeRow({
      id: `id-${this.rows.size + 1}`,
      key: `IIS-${this.rows.size + 1}`,
      title: input.title,
      description: input.description ?? null,
      reporterAdminId: input.reporterAdminId,
      startAt: input.startAt ? new Date(input.startAt) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
    });
    this.rows.set(row.id, row);
    return row;
  }
  async update(id: string, input: UpdateIssueInput) {
    const cur = this.rows.get(id);
    if (!cur) throw new Error('not found');
    const next = { ...cur, ...input } as IssueWithReporters;
    this.rows.set(id, next);
    return next;
  }
  async move(id: string, input: MoveIssueInput) {
    const cur = this.rows.get(id);
    if (!cur) throw new Error('not found');
    const next = { ...cur, status: input.toStatus, orderInColumn: input.toIndex };
    this.rows.set(id, next);
    return next;
  }
  async remove(id: string) {
    this.rows.delete(id);
  }
}

describe('Issue use cases', () => {
  it('TC-ISS-001: create requires title', async () => {
    const repo = new FakeRepo();
    const uc = new CreateIssueUseCase(repo);
    await expect(uc.execute({ title: '', reporterAdminId: 'r' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('TC-ISS-002: create persists and lists', async () => {
    const repo = new FakeRepo();
    await new CreateIssueUseCase(repo).execute({ title: 'A', reporterAdminId: 'r' });
    const list = await new ListIssuesUseCase(repo).execute();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('A');
  });

  it('TC-ISS-003: get by key resolves; missing → 404', async () => {
    const repo = new FakeRepo();
    const created = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
    });
    const get = new GetIssueUseCase(repo);
    const found = await get.execute(created.key);
    expect(found.id).toBe(created.id);
    await expect(get.execute('IIS-999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TC-ISS-004: update + move + delete happy path', async () => {
    const repo = new FakeRepo();
    const created = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
    });
    const upd = await new UpdateIssueUseCase(repo).execute(created.id, { title: 'B' });
    expect(upd.title).toBe('B');
    const moved = await new MoveIssueUseCase(repo).execute(created.id, {
      toStatus: 'IN_PROGRESS',
      toIndex: 0,
    });
    expect(moved.status).toBe('IN_PROGRESS');
    await new DeleteIssueUseCase(repo).execute(created.id);
    expect(await repo.findById(created.id)).toBeNull();
  });

  it('TC-ISS-005: move rejects negative index', async () => {
    const repo = new FakeRepo();
    const created = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
    });
    await expect(
      new MoveIssueUseCase(repo).execute(created.id, { toStatus: 'TODO', toIndex: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('TC-ISS-006: create rejects startAt > dueDate (FR-103-C)', async () => {
    const repo = new FakeRepo();
    await expect(
      new CreateIssueUseCase(repo).execute({
        title: 'A',
        reporterAdminId: 'r',
        startAt: '2026-05-15',
        dueDate: '2026-05-10',
      }),
    ).rejects.toMatchObject({ code: 'ISSUE_INVALID_DATE_RANGE' });
  });

  it('TC-ISS-007: create accepts startAt <= dueDate', async () => {
    const repo = new FakeRepo();
    const out = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
      startAt: '2026-05-08',
      dueDate: '2026-05-10',
    });
    expect(out.id).toBeDefined();
  });

  it('TC-ISS-008: update merges with existing dates for range check', async () => {
    const repo = new FakeRepo();
    const created = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
      startAt: '2026-05-08',
      dueDate: '2026-05-10',
    });
    await expect(
      new UpdateIssueUseCase(repo).execute(created.id, { dueDate: '2026-05-07' }),
    ).rejects.toMatchObject({ code: 'ISSUE_INVALID_DATE_RANGE' });
  });

  it('TC-ISS-009: create sanitizes script tags from description (FR-103-D)', async () => {
    const repo = new FakeRepo();
    const out = await new CreateIssueUseCase(repo).execute({
      title: 'A',
      reporterAdminId: 'r',
      description: '<p>hi</p><script>alert(1)</script><img src=x onerror=alert(1)>',
    });
    expect(out.description).toContain('<p>hi</p>');
    expect(out.description).not.toContain('<script>');
    expect(out.description).not.toContain('onerror');
  });
});
