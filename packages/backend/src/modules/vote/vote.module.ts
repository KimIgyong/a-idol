import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { AuditionModule } from '../audition/audition.module';
import { CatalogModule } from '../catalog/catalog.module';
import {
  LEADERBOARD_AUDIT_QUEUE,
  RANKING_SNAPSHOT_QUEUE,
} from '../../shared/queue/queue.module';
import { CastHeartVoteUseCase } from './application/cast-heart-vote.usecase';
import { GetLeaderboardUseCase } from './application/leaderboard.usecase';
import { GetMyVoteStatusUseCase } from './application/my-vote-status.usecase';
import { SnapshotRankingUseCase } from './application/snapshot-ranking.usecase';
import {
  VOTE_AUDIT_REPOSITORY,
  VOTE_COUNTER_REPOSITORY,
} from './application/interfaces';
import { VOTE_TICKET_REPOSITORY } from './application/ticket-interfaces';
import { CastTicketVoteUseCase } from './application/cast-ticket-vote.usecase';
import { GetMyTicketsUseCase } from './application/my-tickets.usecase';
import { ListMyVotesUseCase } from './application/list-my-votes.usecase';
import { ReconcileLeaderboardUseCase } from './application/reconcile-leaderboard.usecase';
import { AuditLeaderboardUseCase } from './application/audit-leaderboard.usecase';
import { RedisVoteCounterRepository } from './infrastructure/redis-vote-counter.repository';
import { PrismaVoteAuditRepository } from './infrastructure/prisma-vote-audit.repository';
import { PrismaVoteTicketRepository } from './infrastructure/prisma-vote-ticket.repository';
import { RankingSnapshotProcessor } from './infrastructure/ranking-snapshot.processor';
import { LeaderboardAuditProcessor } from './infrastructure/leaderboard-audit.processor';
import { RoundClosedListener } from './infrastructure/round-closed.listener';
import { VoteController } from './presentation/vote.controller';
import { AdminVoteController } from './presentation/admin-vote.controller';

@Module({
  imports: [
    IdentityModule,
    AdminOpsModule,
    AuditionModule,
    CatalogModule,
    BullModule.registerQueue(
      { name: RANKING_SNAPSHOT_QUEUE },
      { name: LEADERBOARD_AUDIT_QUEUE },
    ),
  ],
  controllers: [VoteController, AdminVoteController],
  providers: [
    CastHeartVoteUseCase,
    CastTicketVoteUseCase,
    GetLeaderboardUseCase,
    GetMyVoteStatusUseCase,
    GetMyTicketsUseCase,
    ListMyVotesUseCase,
    ReconcileLeaderboardUseCase,
    AuditLeaderboardUseCase,
    SnapshotRankingUseCase,
    RankingSnapshotProcessor,
    LeaderboardAuditProcessor,
    RoundClosedListener,
    { provide: VOTE_COUNTER_REPOSITORY, useClass: RedisVoteCounterRepository },
    { provide: VOTE_AUDIT_REPOSITORY, useClass: PrismaVoteAuditRepository },
    { provide: VOTE_TICKET_REPOSITORY, useClass: PrismaVoteTicketRepository },
  ],
  // CommerceModule's VoteTicketFulfiller resolves VOTE_TICKET_REPOSITORY.
  exports: [VOTE_TICKET_REPOSITORY],
})
export class VoteModule {}
