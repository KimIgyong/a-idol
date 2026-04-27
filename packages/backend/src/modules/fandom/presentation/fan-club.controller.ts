import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  FanClubStatusDto,
  MembershipDto,
  PaginatedResponseDto,
} from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { GetFanClubStatusUseCase } from '../application/get-fan-club-status.usecase';
import { JoinFanClubUseCase } from '../application/join-fan-club.usecase';
import { LeaveFanClubUseCase } from '../application/leave-fan-club.usecase';
import { ListMyMembershipsUseCase } from '../application/list-my-memberships.usecase';
import { ListFandomQuery } from './dto/list-fandom.dto';
import {
  toFanClubStatusDto,
  toMembershipDto,
} from './dto/fan-club-view';

@ApiTags('fan-club')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FanClubController {
  constructor(
    private readonly status: GetFanClubStatusUseCase,
    private readonly join: JoinFanClubUseCase,
    private readonly leave: LeaveFanClubUseCase,
    private readonly list: ListMyMembershipsUseCase,
  ) {}

  @Get('idols/:id/fan-club')
  @ApiOperation({ summary: 'Fan club info + my membership state' })
  async getStatus(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<FanClubStatusDto> {
    const { fanClub, membership } = await this.status.execute({ userId: user.id, idolId });
    return toFanClubStatusDto(fanClub, membership);
  }

  @Post('idols/:id/fan-club/join')
  @HttpCode(200)
  @ApiOperation({ summary: 'Join fan club (idempotent; rejoins after leave)' })
  async postJoin(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<FanClubStatusDto> {
    const { fanClub, membership } = await this.join.execute({ userId: user.id, idolId });
    return toFanClubStatusDto(fanClub, membership);
  }

  @Post('idols/:id/fan-club/leave')
  @HttpCode(200)
  @ApiOperation({ summary: 'Leave fan club (idempotent)' })
  async postLeave(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<FanClubStatusDto> {
    const { fanClub, membership } = await this.leave.execute({ userId: user.id, idolId });
    return toFanClubStatusDto(fanClub, membership);
  }

  @Get('me/memberships')
  @ApiOperation({ summary: 'My active fan club memberships' })
  async getMy(
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ListFandomQuery,
  ): Promise<PaginatedResponseDto<MembershipDto>> {
    const res = await this.list.execute({ userId: user.id, page: q.page, size: q.size });
    return {
      items: res.items.map(toMembershipDto),
      nextCursor: res.nextCursor,
      total: res.total,
    };
  }
}
