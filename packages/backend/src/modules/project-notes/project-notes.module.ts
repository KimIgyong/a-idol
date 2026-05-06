import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { MediaModule } from '../media/media.module';
import {
  CreateProjectNoteUseCase,
  DeleteProjectNoteUseCase,
  GetProjectNoteUseCase,
  ListProjectNotesUseCase,
  TogglePinProjectNoteUseCase,
  UpdateProjectNoteUseCase,
} from './application/project-note.usecases';
import { PROJECT_NOTE_REPOSITORY } from './application/interfaces';
import { PrismaProjectNoteRepository } from './infrastructure/prisma-project-note.repository';
import { AdminProjectNotesController } from './presentation/admin-project-notes.controller';

@Module({
  imports: [AdminOpsModule, MediaModule],
  controllers: [AdminProjectNotesController],
  providers: [
    ListProjectNotesUseCase,
    GetProjectNoteUseCase,
    CreateProjectNoteUseCase,
    UpdateProjectNoteUseCase,
    DeleteProjectNoteUseCase,
    TogglePinProjectNoteUseCase,
    { provide: PROJECT_NOTE_REPOSITORY, useClass: PrismaProjectNoteRepository },
  ],
})
export class ProjectNotesModule {}
