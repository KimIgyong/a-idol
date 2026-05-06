/**
 * RPT-260506 — repo `docs/**.md` → `project_documents` 동기화 로직.
 *
 * `prisma/seed.ts` 의 ProjectDocument seeding 로직을 추출, 재사용 가능한
 * pure 함수로 만든다. 다음 두 곳에서 호출:
 *   1) seed.ts (초기 시딩 — 항상 모든 파일 upsert)
 *   2) `scripts/sync-docs.ts` CLI + admin sync-from-repo API
 *
 * idempotent guarantees:
 *  - 같은 content 면 version/updatedAt 변경 없음 (unchanged)
 *  - content 변경 시 version+1 (updated)
 *  - DB 에 있던 파일이 사라지면 status=ARCHIVED (archived)
 *  - 신규 파일은 INSERT (created)
 *
 * 보안 (NFR-006): repoRoot 는 호출자가 명시. 파일 경로는 재귀 스캔하되
 * pickFiles 가 정의한 sub-directory 만 (`docs/adr`, `docs/design`, ...) 읽음.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { PrismaClient, Prisma } from '@prisma/client';

export type ProjectDocSyncCategory =
  | 'ADR'
  | 'DESIGN'
  | 'IMPLEMENTATION'
  | 'DELIVERABLE'
  | 'REPORT'
  | 'OPS';

export interface ProjectDocSyncResult {
  created: number;
  updated: number;
  unchanged: number;
  archived: number;
  durationMs: number;
  scannedFiles: number;
}

interface SeedSpec {
  relPath: string;
  category: ProjectDocSyncCategory;
  orderIndex: number;
  tags?: string;
}

interface DirSpec {
  dir: string;
  category: ProjectDocSyncCategory;
  tags?: string;
}

const SOURCE_DIRS: DirSpec[] = [
  { dir: 'docs/adr', category: 'ADR', tags: 'architecture-decision' },
  { dir: 'docs/design', category: 'DESIGN', tags: 'design' },
  { dir: 'docs/implementation', category: 'IMPLEMENTATION', tags: 'wbs,plan,convention' },
  { dir: 'docs/report', category: 'REPORT', tags: 'report' },
  { dir: 'docs/feature/design-asset-cms', category: 'DELIVERABLE', tags: 'design-asset,t-085' },
];

function stableUuidFor(key: string): string {
  const h = createHash('sha256').update(key).digest('hex');
  return [
    h.slice(0, 8),
    h.slice(8, 12),
    '4' + h.slice(13, 16),
    '8' + h.slice(17, 20),
    h.slice(20, 32),
  ].join('-');
}

export function slugifyDocPath(relPath: string): string {
  return relPath
    .replace(/^docs\//, '')
    .replace(/\.md$/, '')
    .toLowerCase()
    .replace(/[/_]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function extractTitle(content: string, fallback: string): string {
  const fm = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fm) {
    const t = fm[1].match(/^title:\s*(.+?)\s*$/m);
    if (t) return t[1].replace(/^["']|["']$/g, '').slice(0, 200);
  }
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim().slice(0, 200);
  const h2 = content.match(/^##\s+(.+)$/m);
  if (h2) return h2[1].trim().slice(0, 200);
  return fallback.replace(/^docs\//, '').replace(/\.md$/, '').slice(0, 200);
}

export function extractSummary(content: string): string | null {
  const lines = content.split('\n').slice(0, 60);
  for (const l of lines) {
    const trimmed = l.trim();
    if (
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('-')
    ) {
      continue;
    }
    return trimmed.slice(0, 500);
  }
  return null;
}

function collectSeeds(repoRoot: string): SeedSpec[] {
  const seeds: SeedSpec[] = [];
  for (const spec of SOURCE_DIRS) {
    const abs = join(repoRoot, spec.dir);
    if (!existsSync(abs)) continue;
    const files = readdirSync(abs)
      .filter((f) => f.endsWith('.md') && f !== 'README.md')
      .sort();
    files.forEach((f, idx) => {
      seeds.push({
        relPath: join(spec.dir, f),
        category: spec.category,
        orderIndex: idx,
        tags: spec.tags,
      });
    });
  }
  return seeds;
}

interface SyncOptions {
  prisma: PrismaClient;
  repoRoot: string;
  adminId: string;
  /** When true, ARCHIVED rows whose source file reappears are restored to APPROVED. */
  restoreArchived?: boolean;
}

/**
 * Sync repo docs into the `project_documents` table.
 * Reads SOURCE_DIRS from `repoRoot`, upserts each `.md`, and ARCHIVES
 * rows whose underlying file disappeared.
 */
export async function syncProjectDocs(
  opts: SyncOptions,
): Promise<ProjectDocSyncResult> {
  const { prisma, repoRoot, adminId } = opts;
  const restoreArchived = opts.restoreArchived ?? true;
  const start = Date.now();

  // NFR-006 — repoRoot path normalization. Caller always passes an absolute
  // path; resolve to canonical form so traversal is auditable.
  const root = resolve(repoRoot);
  const seeds = collectSeeds(root);
  const seenSlugs = new Set<string>();

  let created = 0;
  let updated = 0;
  let unchanged = 0;

  for (const ds of seeds) {
    const abs = join(root, ds.relPath);
    const content = readFileSync(abs, 'utf-8');
    const slug = slugifyDocPath(ds.relPath);
    seenSlugs.add(slug);
    const title = extractTitle(content, ds.relPath);
    const summary = extractSummary(content);

    const existing = await prisma.projectDocument.findUnique({ where: { slug } });
    if (!existing) {
      await prisma.projectDocument.create({
        data: {
          id: stableUuidFor(`project-doc-${slug}`),
          slug,
          title,
          category: ds.category,
          status: 'APPROVED',
          sourceType: 'FILE',
          sourcePath: ds.relPath,
          summary,
          content,
          tags: ds.tags ?? null,
          orderIndex: ds.orderIndex,
          version: 1,
          createdBy: adminId,
          updatedBy: adminId,
        },
      });
      created++;
      continue;
    }

    const contentChanged = existing.content !== content;
    const metaChanged =
      existing.title !== title ||
      existing.summary !== summary ||
      existing.sourcePath !== ds.relPath ||
      existing.sourceType !== 'FILE' ||
      existing.category !== ds.category ||
      existing.tags !== (ds.tags ?? null) ||
      existing.orderIndex !== ds.orderIndex;
    const archivedReturning = restoreArchived && existing.status === 'ARCHIVED';

    if (!contentChanged && !metaChanged && !archivedReturning) {
      unchanged++;
      continue;
    }

    const data: Prisma.ProjectDocumentUpdateInput = {
      title,
      category: ds.category,
      sourcePath: ds.relPath,
      sourceType: 'FILE',
      summary,
      tags: ds.tags ?? null,
      orderIndex: ds.orderIndex,
      updatedBy: adminId,
    };
    if (contentChanged) {
      data.content = content;
      data.version = { increment: 1 };
    }
    if (archivedReturning) {
      data.status = 'APPROVED';
    }
    await prisma.projectDocument.update({ where: { slug }, data });
    updated++;
  }

  // FR-DOCS-SYNC-007 — files that disappeared on disk → ARCHIVED.
  const archivedRes = await prisma.projectDocument.updateMany({
    where: {
      sourceType: 'FILE',
      status: { not: 'ARCHIVED' },
      slug: { notIn: Array.from(seenSlugs) },
    },
    data: { status: 'ARCHIVED', updatedBy: adminId },
  });

  return {
    created,
    updated,
    unchanged,
    archived: archivedRes.count,
    durationMs: Date.now() - start,
    scannedFiles: seeds.length,
  };
}
