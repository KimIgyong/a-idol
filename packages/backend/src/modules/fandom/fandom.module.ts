import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { ToggleHeartUseCase } from './application/toggle-heart.usecase';
import { ToggleFollowUseCase } from './application/toggle-follow.usecase';
import { ListMyFollowsUseCase, ListMyHeartsUseCase } from './application/list-my-fandom.usecase';
import { GetFanClubStatusUseCase } from './application/get-fan-club-status.usecase';
import { JoinFanClubUseCase } from './application/join-fan-club.usecase';
import { LeaveFanClubUseCase } from './application/leave-fan-club.usecase';
import { ListMyMembershipsUseCase } from './application/list-my-memberships.usecase';
import { CreateCheerUseCase, ListCheersForIdolUseCase } from './application/cheer.usecases';
import {
  CHEER_REPOSITORY,
  FAN_CLUB_REPOSITORY,
  FOLLOW_REPOSITORY,
  HEART_REPOSITORY,
} from './application/interfaces';
import { PrismaHeartRepository } from './infrastructure/prisma-heart.repository';
import { PrismaFollowRepository } from './infrastructure/prisma-follow.repository';
import { PrismaFanClubRepository } from './infrastructure/prisma-fan-club.repository';
import { PrismaCheerRepository } from './infrastructure/prisma-cheer.repository';
import { FandomController } from './presentation/fandom.controller';
import { FanClubController } from './presentation/fan-club.controller';
import { CheerController } from './presentation/cheer.controller';

@Module({
  imports: [IdentityModule],
  controllers: [FandomController, FanClubController, CheerController],
  providers: [
    ToggleHeartUseCase,
    ToggleFollowUseCase,
    ListMyHeartsUseCase,
    ListMyFollowsUseCase,
    GetFanClubStatusUseCase,
    JoinFanClubUseCase,
    LeaveFanClubUseCase,
    ListMyMembershipsUseCase,
    CreateCheerUseCase,
    ListCheersForIdolUseCase,
    { provide: HEART_REPOSITORY, useClass: PrismaHeartRepository },
    { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
    { provide: FAN_CLUB_REPOSITORY, useClass: PrismaFanClubRepository },
    { provide: CHEER_REPOSITORY, useClass: PrismaCheerRepository },
  ],
})
export class FandomModule {}
