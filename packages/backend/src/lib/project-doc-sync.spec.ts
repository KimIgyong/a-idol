/**
 * RPT-260506 — syncProjectDocs 단위 테스트.
 * fake prisma + tmp 디렉토리. 실제 Postgres 없이 동작.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncProjectDocs } from './project-doc-sync';

interface FakeRow {
  slug: string;
  title: string;
  category: string;
  status: string;
  sourceType: string;
  sourcePath: string | null;
  summary: string | null;
  content: string;
  tags: string | null;
  orderIndex: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

function makeFakePrisma() {
  const rows = new Map<string, FakeRow>();
  const projectDocument = {
    findUnique: jest.fn(async (args: { where: { slug: string } }) => {
      return rows.get(args.where.slug) ?? null;
    }),
    create: jest.fn(async (args: { data: Record<string, unknown> }) => {
      const r: FakeRow = {
        slug: String(args.data.slug),
        title: String(args.data.title),
        category: String(args.data.category),
        status: String(args.data.status ?? 'DRAFT'),
        sourceType: String(args.data.sourceType ?? 'INLINE'),
        sourcePath: (args.data.sourcePath as string) ?? null,
        summary: (args.data.summary as string) ?? null,
        content: String(args.data.content),
        tags: (args.data.tags as string) ?? null,
        orderIndex: Number(args.data.orderIndex ?? 0),
        version: Number(args.data.version ?? 1),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      rows.set(r.slug, r);
      return r;
    }),
    update: jest.fn(
      async (args: { where: { slug: string }; data: Record<string, unknown> }) => {
        const cur = rows.get(args.where.slug);
        if (!cur) throw new Error(`fake: missing ${args.where.slug}`);
        const next = { ...cur };
        for (const [k, v] of Object.entries(args.data)) {
          if (k === 'version' && typeof v === 'object' && v && 'increment' in v) {
            next.version = cur.version + Number((v as { increment: number }).increment);
          } else if (v !== undefined) {
            (next as Record<string, unknown>)[k] = v;
          }
        }
        next.updatedAt = new Date();
        rows.set(next.slug, next);
        return next;
      },
    ),
    updateMany: jest.fn(
      async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        const notIn = (args.where.slug as { notIn?: string[] } | undefined)?.notIn;
        const statusNotArchived =
          (args.where.status as { not?: string } | undefined)?.not === 'ARCHIVED';
        const sourceTypeFile = args.where.sourceType === 'FILE';
        for (const r of rows.values()) {
          if (notIn && notIn.includes(r.slug)) continue;
          if (sourceTypeFile && r.sourceType !== 'FILE') continue;
          if (statusNotArchived && r.status === 'ARCHIVED') continue;
          for (const [k, v] of Object.entries(args.data)) {
            (r as unknown as Record<string, unknown>)[k] = v;
          }
          count++;
        }
        return { count };
      },
    ),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { rows, prisma: { projectDocument } as any };
}

function setupRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'docsync-'));
  mkdirSync(join(root, 'docs', 'adr'), { recursive: true });
  mkdirSync(join(root, 'docs', 'design'), { recursive: true });
  return root;
}

const ADMIN = '00000000-0000-0000-0000-0000000000ad';

describe('syncProjectDocs', () => {
  let repoRoot: string;
  afterEach(() => {
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it('TC-DOCS-001 — first run inserts all files as created', async () => {
    repoRoot = setupRepo();
    writeFileSync(
      join(repoRoot, 'docs', 'adr', 'ADR-001-test.md'),
      '# Test ADR\n\nSome description body.\n',
    );
    writeFileSync(
      join(repoRoot, 'docs', 'design', 'a-idol-arch.md'),
      '---\ntitle: Architecture\n---\n# Heading\n\nDesign body.\n',
    );
    const { prisma, rows } = makeFakePrisma();
    const r = await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(r.created).toBe(2);
    expect(r.updated).toBe(0);
    expect(r.unchanged).toBe(0);
    expect(r.archived).toBe(0);
    expect(rows.size).toBe(2);
  });

  it('TC-DOCS-002 — second run with no changes reports unchanged only', async () => {
    repoRoot = setupRepo();
    writeFileSync(join(repoRoot, 'docs', 'adr', 'ADR-001-x.md'), '# X\nbody x\n');
    const { prisma } = makeFakePrisma();
    await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    const r = await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(r.created).toBe(0);
    expect(r.updated).toBe(0);
    expect(r.unchanged).toBe(1);
    expect(r.archived).toBe(0);
  });

  it('TC-DOCS-003 — content change increments version', async () => {
    repoRoot = setupRepo();
    const file = join(repoRoot, 'docs', 'adr', 'ADR-001-y.md');
    writeFileSync(file, '# Y\nv1\n');
    const { prisma, rows } = makeFakePrisma();
    await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    const before = Array.from(rows.values())[0];
    expect(before.version).toBe(1);

    writeFileSync(file, '# Y\nv2 changed\n');
    const r = await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(r.updated).toBe(1);
    const after = Array.from(rows.values())[0];
    expect(after.version).toBe(2);
    expect(after.content).toContain('v2 changed');
  });

  it('TC-DOCS-004 — missing file → status ARCHIVED', async () => {
    repoRoot = setupRepo();
    const file = join(repoRoot, 'docs', 'adr', 'ADR-removed.md');
    writeFileSync(file, '# Removed\nbody\n');
    const { prisma, rows } = makeFakePrisma();
    await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(Array.from(rows.values())[0].status).toBe('APPROVED');

    rmSync(file);
    const r = await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(r.archived).toBe(1);
    expect(Array.from(rows.values())[0].status).toBe('ARCHIVED');
  });

  it('TC-DOCS-005 — archived file restored when source reappears', async () => {
    repoRoot = setupRepo();
    const file = join(repoRoot, 'docs', 'adr', 'ADR-roundtrip.md');
    writeFileSync(file, '# RT\nv1\n');
    const { prisma, rows } = makeFakePrisma();
    await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    rmSync(file);
    await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(Array.from(rows.values())[0].status).toBe('ARCHIVED');

    writeFileSync(file, '# RT\nv1\n');
    const r = await syncProjectDocs({ prisma, repoRoot, adminId: ADMIN });
    expect(r.updated).toBe(1);
    expect(Array.from(rows.values())[0].status).toBe('APPROVED');
  });
});
