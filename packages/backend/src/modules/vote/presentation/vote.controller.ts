import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type {
  CastVoteResultDto,
  MyVoteEntryDto,
  MyVoteStatusDto,
  MyVoteTicketsDto,
  PaginatedResponseDto,
  RoundLeaderboardDto,
  VoteMethod,
} from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { CastHeartVoteUseCase } from '../application/cast-heart-vote.usecase';
import { CastTicketVoteUseCase } from '../application/cast-ticket-vote.usecase';
import { GetLeaderboardUseCase } from '../application/leaderboard.usecase';
import { GetMyVoteStatusUseCase } from '../application/my-vote-status.usecase';
import { GetMyTicketsUseCase } from '../application/my-tickets.usecase';
import { ListMyVotesUseCase } from '../application/list-my-votes.usecase';
import type { MyVoteEntry } from '../application/interfaces';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ADR-023 — Request DTO 는 snake_case (amb-starter-kit v2.0).
class CastVoteBody {
  @IsString()
  @Matches(UUID_REGEX, { message: 'idol_id must be a UUID' })
  idol_id!: string;

  @IsIn(['HEART', 'TICKET'], { message: 'method must be HEART or TICKET (SMS pending)' })
  method!: VoteMethod;
}

class ListMyVotesQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size?: number;
}

function toMyVoteEntryDto(e: MyVoteEntry): MyVoteEntryDto {
  return {
    id: e.id,
    roundId: e.roundId,
    roundName: e.roundName,
    auditionId: e.auditionId,
    auditionName: e.auditionName,
    idolId: e.idolId,
    idolName: e.idolName,
    idolStageName: e.idolStageName,
    idolHeroImageUrl: e.idolHeroImageUrl,
    method: e.method,
    weight: e.weight,
    createdAt: e.createdAt.toISOString(),
  };
}

@ApiTags('vote')
@Controller()
export class VoteController {
  constructor(
    private readonly castHeart: CastHeartVoteUseCase,
    private readonly castTicket: CastTicketVoteUseCase,
    private readonly leaderboard: GetLeaderboardUseCase,
    private readonly myStatus: GetMyVoteStatusUseCase,
    private readonly myTickets: GetMyTicketsUseCase,
    private readonly listMyVotes: ListMyVotesUseCase,
  ) {}

  @Post('rounds/:roundId/votes')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Cast a HEART or TICKET vote for an idol in this round' })
  async postVote(
    @CurrentUser() user: CurrentUserContext,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Body() body: CastVoteBody,
  ): Promise<CastVoteResultDto> {
    if (body.method === 'TICKET') {
      const res = await this.castTicket.execute({
        userId: user.id,
        roundId,
        idolId: body.idol_id,
      });
      return {
        roundId: res.roundId,
        idolId: res.idolId,
        method: 'TICKET',
        weightApplied: res.weightApplied,
        // TICKET has no daily limit — mirror the remaining ticket balance here.
        dailyUsed: 0,
        dailyLimit: res.ticketBalanceAfter,
        scoreAfter: res.scoreAfter,
      };
    }
    const res = await this.castHeart.execute({
      userId: user.id,
      roundId,
      idolId: body.idol_id,
    });
    return {
      roundId: res.roundId,
      idolId: res.idolId,
      method: 'HEART',
      weightApplied: res.weightApplied,
      dailyUsed: res.dailyUsed,
      dailyLimit: res.dailyLimit,
      scoreAfter: res.scoreAfter,
    };
  }

  @Get('rounds/:roundId/leaderboard')
  @ApiOperation({ summary: 'Round leaderboard (public; Redis sorted-set snapshot)' })
  async getLeaderboard(
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<RoundLeaderboardDto> {
    const view = await this.leaderboard.execute(roundId);
    return view;
  }

  @Get('rounds/:roundId/me/vote-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Caller's daily HEART-vote counter for this round" })
  async getMyStatus(
    @CurrentUser() user: CurrentUserContext,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<MyVoteStatusDto> {
    const v = await this.myStatus.execute({ userId: user.id, roundId });
    return {
      roundId: v.roundId,
      method: 'HEART',
      dailyUsed: v.dailyUsed,
      dailyLimit: v.dailyLimit,
      resetAt: v.resetAt.toISOString(),
    };
  }

  @Get('me/votes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'SCR-023 — 내 투표 이력 (paginated, 최신순)' })
  async getMyVotes(
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ListMyVotesQuery,
  ): Promise<PaginatedResponseDto<MyVoteEntryDto>> {
    const res = await this.listMyVotes.execute({
      userId: user.id,
      page: q.page,
      size: q.size,
    });
    return {
      items: res.items.map(toMyVoteEntryDto),
      total: res.total,
      nextCursor: res.nextCursor,
    };
  }

  @Get('me/vote-tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Caller's vote-ticket balance: global (any round) + round-scoped buckets (T-062b)",
  })
  async getMyTickets(@CurrentUser() user: CurrentUserContext): Promise<MyVoteTicketsDto> {
    const v = await this.myTickets.execute(user.id);
    return {
      balance: v.global.balance,
      updatedAt: v.global.updatedAt.toISOString(),
      roundBalances: v.rounds.map((r) => ({
        roundId: r.roundId,
        balance: r.balance,
        updatedAt: r.updatedAt.toISOString(),
      })),
    };
  }
}
