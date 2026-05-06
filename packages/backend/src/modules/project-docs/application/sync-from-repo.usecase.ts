/**
 * RPT-260506 — admin sync-from-repo usecase. controller 가 호출.
 * lib/project-doc-sync.ts 의 pure 함수를 PrismaService 로 wrap.
 */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import {
  syncProjectDocs,
  type ProjectDocSyncResult,
} from '../../../lib/project-doc-sync';

@Injectable()
export class SyncProjectDocsFromRepoUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(adminId: string): Promise<ProjectDocSyncResult> {
    // NFR-006 — repoRoot 는 컨테이너 내부 정적 경로 (이미지 빌드 시 고정).
    // env override 가능하지만 production 에서는 unset.
    const repoRoot = process.env.PROJECT_DOCS_REPO_ROOT ?? process.cwd();
    return syncProjectDocs({ prisma: this.prisma, repoRoot, adminId });
  }
}
