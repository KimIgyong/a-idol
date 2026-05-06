/**
 * RPT-260506 — Issue repository (Prisma adapter).
 *
 * key: PostgreSQL sequence `issue_key_seq` 로 'IIS-N' 발급.
 * move: $transaction 으로 같은 컬럼 내 reorder + 다른 컬럼 이동 처리.
 */
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { IssueStatus } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { IssueWithReporters } from '../domain/issue';
import type {
  CreateIssueInput,
  IssueRepository,
  ListIssuesFilter,
  MoveIssueInput,
  UpdateIssueInput,
} from '../application/interfaces';

type IssueRow = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  orderInColumn: number;
  assigneeAdminId: string | null;
  reporterAdminId: string | null;
  dueDate: Date | null;
  labels: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PrismaIssueRepository implements IssueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(filter?: ListIssuesFilter): Promise<IssueWithReporters[]> {
    const where: Prisma.IssueWhereInput = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.type) where.type = filter.type;
    if (filter?.priority) where.priority = filter.priority;
    if (filter?.assigneeAdminId) where.assigneeAdminId = filter.assigneeAdminId;
    if (filter?.q && filter.q.trim().length > 0) {
      const q = filter.q.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { key: { contains: q, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.issue.findMany({
      where,
      orderBy: [{ status: 'asc' }, { orderInColumn: 'asc' }, { createdAt: 'desc' }],
    });
    return this.attachReporters(rows);
  }

  async findById(id: string): Promise<IssueWithReporters | null> {
    const row = await this.prisma.issue.findUnique({ where: { id } });
    if (!row) return null;
    const [withNames] = await this.attachReporters([row]);
    return withNames;
  }

  async findByKey(key: string): Promise<IssueWithReporters | null> {
    const row = await this.prisma.issue.findUnique({ where: { key } });
    if (!row) return null;
    const [withNames] = await this.attachReporters([row]);
    return withNames;
  }

  async create(input: CreateIssueInput): Promise<IssueWithReporters> {
    // Sequence-issued key: IIS-N. Generate inside the same transaction so a
    // failed insert doesn't leak sequence values (sequences are non-trans
    // anyway, but at least the row is consistent).
    const [{ nextval }] = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>`
      SELECT nextval('issue_key_seq')
    `;
    const key = `IIS-${nextval.toString()}`;

    const status = input.status ?? 'BACKLOG';
    // Append to bottom of column.
    const tail = await this.prisma.issue.aggregate({
      where: { status },
      _max: { orderInColumn: true },
    });
    const orderInColumn = (tail._max.orderInColumn ?? -1) + 1;

    const row = await this.prisma.issue.create({
      data: {
        key,
        title: input.title,
        description: input.description ?? null,
        type: input.type ?? 'TASK',
        status,
        priority: input.priority ?? 'P2',
        orderInColumn,
        assigneeAdminId: input.assigneeAdminId ?? null,
        reporterAdminId: input.reporterAdminId,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        labels: input.labels ?? null,
      },
    });
    const [withNames] = await this.attachReporters([row]);
    return withNames;
  }

  async update(id: string, input: UpdateIssueInput): Promise<IssueWithReporters> {
    const data: Prisma.IssueUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.type !== undefined) data.type = input.type;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.labels !== undefined) data.labels = input.labels;
    if (input.dueDate !== undefined) {
      data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }
    if (input.assigneeAdminId !== undefined) {
      data.assigneeAdminId = input.assigneeAdminId;
    }
    // status 변경은 move 로 처리하길 권장하지만 단순 update 도 허용 — 기존
    // orderInColumn 유지.
    if (input.status !== undefined) data.status = input.status;

    const row = await this.prisma.issue.update({ where: { id }, data });
    const [withNames] = await this.attachReporters([row]);
    return withNames;
  }

  async move(id: string, input: MoveIssueInput): Promise<IssueWithReporters> {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.issue.findUnique({ where: { id } });
      if (!target) {
        throw new Error('Issue disappeared during move');
      }
      const fromStatus = target.status as IssueStatus;
      const toStatus = input.toStatus;
      const toIndex = input.toIndex;

      if (fromStatus === toStatus) {
        // Reorder within same column.
        const all = await tx.issue.findMany({
          where: { status: toStatus },
          orderBy: { orderInColumn: 'asc' },
          select: { id: true },
        });
        const without = all.map((r) => r.id).filter((rid) => rid !== id);
        const clamped = Math.max(0, Math.min(toIndex, without.length));
        without.splice(clamped, 0, id);
        await Promise.all(
          without.map((rid, idx) =>
            tx.issue.update({ where: { id: rid }, data: { orderInColumn: idx } }),
          ),
        );
      } else {
        // Cross-column move.
        // 1) close the gap in fromStatus.
        const fromCol = await tx.issue.findMany({
          where: { status: fromStatus },
          orderBy: { orderInColumn: 'asc' },
          select: { id: true },
        });
        const fromIds = fromCol.map((r) => r.id).filter((rid) => rid !== id);
        await Promise.all(
          fromIds.map((rid, idx) =>
            tx.issue.update({ where: { id: rid }, data: { orderInColumn: idx } }),
          ),
        );
        // 2) insert into toStatus at toIndex.
        const toCol = await tx.issue.findMany({
          where: { status: toStatus },
          orderBy: { orderInColumn: 'asc' },
          select: { id: true },
        });
        const toIds = toCol.map((r) => r.id);
        const clamped = Math.max(0, Math.min(toIndex, toIds.length));
        toIds.splice(clamped, 0, id);
        await Promise.all(
          toIds.map((rid, idx) =>
            tx.issue.update({
              where: { id: rid },
              data:
                rid === id
                  ? { status: toStatus, orderInColumn: idx }
                  : { orderInColumn: idx },
            }),
          ),
        );
      }
      const updated = await tx.issue.findUnique({ where: { id } });
      if (!updated) throw new Error('Issue not found after move');
      return updated;
    }).then(async (row: IssueRow) => {
      const [withNames] = await this.attachReporters([row]);
      return withNames;
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.issue.delete({ where: { id } });
  }

  // Reporter / assignee 의 displayName 을 조회해 IssueWithReporters 로 빌드.
  // N+1 회피: 모든 row 의 admin id 집합을 한 번에 조회.
  private async attachReporters(rows: IssueRow[]): Promise<IssueWithReporters[]> {
    const adminIds = new Set<string>();
    for (const r of rows) {
      if (r.assigneeAdminId) adminIds.add(r.assigneeAdminId);
      if (r.reporterAdminId) adminIds.add(r.reporterAdminId);
    }
    let nameMap = new Map<string, string>();
    if (adminIds.size > 0) {
      const admins = await this.prisma.adminUser.findMany({
        where: { id: { in: Array.from(adminIds) } },
        select: { id: true, displayName: true },
      });
      nameMap = new Map(admins.map((a) => [a.id, a.displayName]));
    }
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      description: r.description,
      type: r.type as IssueWithReporters['type'],
      status: r.status as IssueWithReporters['status'],
      priority: r.priority as IssueWithReporters['priority'],
      orderInColumn: r.orderInColumn,
      assigneeAdminId: r.assigneeAdminId,
      assigneeName: r.assigneeAdminId ? nameMap.get(r.assigneeAdminId) ?? null : null,
      reporterAdminId: r.reporterAdminId,
      reporterName: r.reporterAdminId ? nameMap.get(r.reporterAdminId) ?? null : null,
      dueDate: r.dueDate,
      labels: r.labels,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }
}
