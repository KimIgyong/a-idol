import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import {
  CreateIssueUseCase,
  DeleteIssueUseCase,
  GetIssueUseCase,
  ListIssuesUseCase,
  MoveIssueUseCase,
  UpdateIssueUseCase,
} from './application/issue.usecases';
import { ISSUE_REPOSITORY } from './application/interfaces';
import { PrismaIssueRepository } from './infrastructure/prisma-issue.repository';
import { AdminIssuesController } from './presentation/admin-issues.controller';

@Module({
  imports: [AdminOpsModule],
  controllers: [AdminIssuesController],
  providers: [
    ListIssuesUseCase,
    GetIssueUseCase,
    CreateIssueUseCase,
    UpdateIssueUseCase,
    MoveIssueUseCase,
    DeleteIssueUseCase,
    { provide: ISSUE_REPOSITORY, useClass: PrismaIssueRepository },
  ],
})
export class IssueTrackerModule {}
