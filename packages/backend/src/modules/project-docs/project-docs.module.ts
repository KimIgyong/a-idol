import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { AdminProjectDocsController } from './presentation/admin-project-docs.controller';
import {
  CreateProjectDocUseCase,
  DeleteProjectDocUseCase,
  GetProjectDocUseCase,
  ListProjectDocsUseCase,
  UpdateProjectDocUseCase,
} from './application/project-doc.usecases';
import { PROJECT_DOC_REPOSITORY } from './application/interfaces';
import { PrismaProjectDocRepository } from './infrastructure/prisma-project-doc.repository';

@Module({
  imports: [AdminOpsModule],
  controllers: [AdminProjectDocsController],
  providers: [
    ListProjectDocsUseCase,
    GetProjectDocUseCase,
    CreateProjectDocUseCase,
    UpdateProjectDocUseCase,
    DeleteProjectDocUseCase,
    { provide: PROJECT_DOC_REPOSITORY, useClass: PrismaProjectDocRepository },
  ],
})
export class ProjectDocsModule {}
