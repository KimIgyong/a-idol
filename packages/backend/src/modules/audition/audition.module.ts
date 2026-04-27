import { Module } from '@nestjs/common';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { CatalogModule } from '../catalog/catalog.module';
import {
  AddEntriesUseCase,
  CreateAuditionUseCase,
  DeleteAuditionUseCase,
  GetAuditionUseCase,
  ListAuditionsUseCase,
  RemoveEntryUseCase,
  TransitionAuditionUseCase,
  UpdateAuditionUseCase,
} from './application/audition.usecases';
import {
  CreateRoundUseCase,
  DeleteRoundUseCase,
  TransitionRoundUseCase,
  UpdateRoundUseCase,
} from './application/round.usecases';
import {
  DeleteVoteRuleUseCase,
  GetVoteRuleUseCase,
  UpsertVoteRuleUseCase,
} from './application/vote-rule.usecases';
import {
  AUDITION_ENTRY_REPOSITORY,
  AUDITION_REPOSITORY,
  ROUND_REPOSITORY,
} from './application/interfaces';
import { VOTE_RULE_REPOSITORY } from './application/vote-rule-interfaces';
import { PrismaAuditionRepository } from './infrastructure/prisma-audition.repository';
import { PrismaRoundRepository } from './infrastructure/prisma-round.repository';
import { PrismaAuditionEntryRepository } from './infrastructure/prisma-audition-entry.repository';
import { PrismaVoteRuleRepository } from './infrastructure/prisma-vote-rule.repository';
import { AdminAuditionController } from './presentation/admin-audition.controller';
import { PublicAuditionController } from './presentation/public-audition.controller';

@Module({
  imports: [AdminOpsModule, CatalogModule],
  controllers: [AdminAuditionController, PublicAuditionController],
  providers: [
    CreateAuditionUseCase,
    ListAuditionsUseCase,
    GetAuditionUseCase,
    UpdateAuditionUseCase,
    TransitionAuditionUseCase,
    DeleteAuditionUseCase,
    AddEntriesUseCase,
    RemoveEntryUseCase,
    CreateRoundUseCase,
    UpdateRoundUseCase,
    TransitionRoundUseCase,
    DeleteRoundUseCase,
    UpsertVoteRuleUseCase,
    GetVoteRuleUseCase,
    DeleteVoteRuleUseCase,
    { provide: AUDITION_REPOSITORY, useClass: PrismaAuditionRepository },
    { provide: ROUND_REPOSITORY, useClass: PrismaRoundRepository },
    { provide: AUDITION_ENTRY_REPOSITORY, useClass: PrismaAuditionEntryRepository },
    { provide: VOTE_RULE_REPOSITORY, useClass: PrismaVoteRuleRepository },
  ],
  // Consumed by VoteModule (T-063).
  exports: [ROUND_REPOSITORY, VOTE_RULE_REPOSITORY],
})
export class AuditionModule {}
