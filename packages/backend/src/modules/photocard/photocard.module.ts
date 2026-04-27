import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { PHOTOCARD_REPOSITORY } from './application/interfaces';
import {
  AddPhotocardTemplateUseCase,
  CreatePhotocardSetUseCase,
  GetPhotocardSetUseCase,
  ListMyPhotocardsUseCase,
  ListPhotocardSetsUseCase,
  UpdatePhotocardSetUseCase,
} from './application/usecases';
import { PrismaPhotocardRepository } from './infrastructure/prisma-photocard.repository';
import { AdminPhotocardController } from './presentation/admin-photocard.controller';
import { PhotocardController } from './presentation/photocard.controller';

@Module({
  imports: [IdentityModule, AdminOpsModule],
  controllers: [PhotocardController, AdminPhotocardController],
  providers: [
    ListPhotocardSetsUseCase,
    GetPhotocardSetUseCase,
    ListMyPhotocardsUseCase,
    CreatePhotocardSetUseCase,
    UpdatePhotocardSetUseCase,
    AddPhotocardTemplateUseCase,
    { provide: PHOTOCARD_REPOSITORY, useClass: PrismaPhotocardRepository },
  ],
  // CommerceModule's PhotocardPackFulfiller resolves PHOTOCARD_REPOSITORY.
  exports: [PHOTOCARD_REPOSITORY],
})
export class PhotocardModule {}
