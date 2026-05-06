/**
 * RPT-260506 — `pnpm sync-docs` CLI 진입점.
 * docker exec 또는 deploy.sh 에서 호출. repo `docs/**.md` → DB project_documents.
 */
import 'dotenv/config';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { syncProjectDocs } from '../src/lib/project-doc-sync';

const DEFAULT_ADMIN_ID = '00000000-0000-0000-0000-0000000000ad';

async function main() {
  const repoRoot = process.env.PROJECT_DOCS_REPO_ROOT
    ? resolve(process.env.PROJECT_DOCS_REPO_ROOT)
    : resolve(__dirname, '..', '..', '..');

  const prisma = new PrismaClient();
  try {
    // 운영 환경에서는 seeded admin 이 존재. local 에서도 seed 실행 필수 전제.
    const admin = await prisma.adminUser.findFirst({
      where: { role: 'admin' },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    const adminId = admin?.id ?? DEFAULT_ADMIN_ID;

    console.log(`📄 syncing project-docs from ${repoRoot} (admin=${adminId.slice(0, 8)}…)`);
    const result = await syncProjectDocs({ prisma, repoRoot, adminId });
    console.log(
      `✅ scanned=${result.scannedFiles} created=${result.created} updated=${result.updated} unchanged=${result.unchanged} archived=${result.archived} (${result.durationMs}ms)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error('❌ sync-docs failed:', e);
  process.exit(1);
});
