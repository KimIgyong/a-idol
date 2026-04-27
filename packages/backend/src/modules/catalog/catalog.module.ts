import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { CatalogController } from './presentation/catalog.controller';
import { AdminCatalogController } from './presentation/admin-catalog.controller';
import { ListIdolsUseCase, IDOL_REPOSITORY } from './application/list-idols.usecase';
import { GetIdolDetailUseCase } from './application/get-idol-detail.usecase';
import {
  CreateAgencyUseCase,
  DeleteAgencyUseCase,
  ListAgenciesUseCase,
  UpdateAgencyUseCase,
} from './application/agency.usecase';
import {
  GetAdminIdolUseCase,
  ListAllIdolsUseCase,
  PublishIdolUseCase,
  SoftDeleteIdolUseCase,
  UnpublishIdolUseCase,
  UpdateIdolUseCase,
} from './application/admin-idol.usecase';
import { CreateIdolUseCase } from './application/create-idol.usecase';
import {
  CreateScheduleUseCase,
  DeleteScheduleUseCase,
  ListSchedulesUseCase,
} from './application/schedule.usecase';
import {
  ADMIN_IDOL_REPOSITORY,
  AGENCY_REPOSITORY,
  IDOL_SCHEDULE_REPOSITORY,
} from './application/admin-interfaces';
import { PrismaIdolRepository } from './infrastructure/prisma-idol.repository';
import { PrismaAgencyRepository } from './infrastructure/prisma-agency.repository';
import { PrismaAdminIdolRepository } from './infrastructure/prisma-admin-idol.repository';
import { PrismaIdolScheduleRepository } from './infrastructure/prisma-schedule.repository';
import { RedisIdolMetaCache } from './infrastructure/redis-idol-meta.cache';
import { IDOL_META_CACHE } from './application/idol-meta-cache.interface';

@Module({
  imports: [AdminOpsModule],
  controllers: [CatalogController, AdminCatalogController],
  providers: [
    ListIdolsUseCase,
    GetIdolDetailUseCase,
    ListAgenciesUseCase,
    CreateAgencyUseCase,
    UpdateAgencyUseCase,
    DeleteAgencyUseCase,
    ListAllIdolsUseCase,
    GetAdminIdolUseCase,
    CreateIdolUseCase,
    UpdateIdolUseCase,
    PublishIdolUseCase,
    UnpublishIdolUseCase,
    SoftDeleteIdolUseCase,
    ListSchedulesUseCase,
    CreateScheduleUseCase,
    DeleteScheduleUseCase,
    { provide: IDOL_REPOSITORY, useClass: PrismaIdolRepository },
    { provide: AGENCY_REPOSITORY, useClass: PrismaAgencyRepository },
    { provide: ADMIN_IDOL_REPOSITORY, useClass: PrismaAdminIdolRepository },
    { provide: IDOL_SCHEDULE_REPOSITORY, useClass: PrismaIdolScheduleRepository },
    { provide: IDOL_META_CACHE, useClass: RedisIdolMetaCache },
  ],
  // ADMIN_IDOL_REPOSITORY: ChatModule (ScheduleAutoMessageUseCase).
  // IDOL_META_CACHE: VoteModule (GetLeaderboardUseCase hydration).
  exports: [ADMIN_IDOL_REPOSITORY, IDOL_META_CACHE],
})
export class CatalogModule {}
