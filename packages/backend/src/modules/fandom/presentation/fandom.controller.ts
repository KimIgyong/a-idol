import { Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type {
  FollowToggleResponseDto,
  HeartToggleResponseDto,
  IdolCardDto,
  PaginatedResponseDto,
} from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { ToggleHeartUseCase } from '../application/toggle-heart.usecase';
import { ToggleFollowUseCase } from '../application/toggle-follow.usecase';
import { ListMyFollowsUseCase, ListMyHeartsUseCase } from '../application/list-my-fandom.usecase';
import { ListFandomQuery } from './dto/list-fandom.dto';

function toCard(i: {
  id: string;
  name: string;
  stageName: string | null;
  heroImageUrl: string | null;
  heartCount: number;
  followCount: number;
  publishedAt: Date | null;
}): IdolCardDto {
  return {
    id: i.id,
    name: i.name,
    stageName: i.stageName,
    heroImageUrl: i.heroImageUrl,
    heartCount: i.heartCount,
    followCount: i.followCount,
    publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
  };
}

@ApiTags('fandom')
@Controller()
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FandomController {
  constructor(
    private readonly toggleHeart: ToggleHeartUseCase,
    private readonly toggleFollow: ToggleFollowUseCase,
    private readonly listHearts: ListMyHeartsUseCase,
    private readonly listFollows: ListMyFollowsUseCase,
  ) {}

  // --- Heart -------------------------------------------------------------
  @Post('idols/:id/heart')
  @HttpCode(200)
  @ApiOperation({ summary: 'Add a heart to the idol (idempotent; no-op if already hearted)' })
  async postHeart(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<HeartToggleResponseDto> {
    const res = await this.ensureTargetState(user.id, idolId, /* want */ true, 'heart');
    return { idolId, hearted: res.state, heartCount: res.count };
  }

  @Delete('idols/:id/heart')
  @HttpCode(200)
  @ApiOperation({ summary: 'Remove heart from the idol (idempotent)' })
  async deleteHeart(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<HeartToggleResponseDto> {
    const res = await this.ensureTargetState(user.id, idolId, /* want */ false, 'heart');
    return { idolId, hearted: res.state, heartCount: res.count };
  }

  // --- Follow ------------------------------------------------------------
  @Post('idols/:id/follow')
  @HttpCode(200)
  @ApiOperation({ summary: 'Follow the idol (idempotent)' })
  async postFollow(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<FollowToggleResponseDto> {
    const res = await this.ensureTargetState(user.id, idolId, /* want */ true, 'follow');
    return { idolId, following: res.state, followCount: res.count };
  }

  @Delete('idols/:id/follow')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unfollow the idol (idempotent)' })
  async deleteFollow(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
  ): Promise<FollowToggleResponseDto> {
    const res = await this.ensureTargetState(user.id, idolId, /* want */ false, 'follow');
    return { idolId, following: res.state, followCount: res.count };
  }

  // --- My fandom lists --------------------------------------------------
  @Get('me/hearts')
  @ApiOperation({ summary: 'My hearted idols' })
  async getMyHearts(
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ListFandomQuery,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponseDto<IdolCardDto> | undefined> {
    return this.handleMyListEtag(
      user.id,
      q,
      ifNoneMatch,
      res,
      'hearts',
      this.listHearts.getIdentity.bind(this.listHearts),
      () => this.listHearts.execute({ userId: user.id, page: q.page, size: q.size }),
    );
  }

  @Get('me/follows')
  @ApiOperation({ summary: 'My followed idols' })
  async getMyFollows(
    @CurrentUser() user: CurrentUserContext,
    @Query() q: ListFandomQuery,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponseDto<IdolCardDto> | undefined> {
    return this.handleMyListEtag(
      user.id,
      q,
      ifNoneMatch,
      res,
      'follows',
      this.listFollows.getIdentity.bind(this.listFollows),
      () => this.listFollows.execute({ userId: user.id, page: q.page, size: q.size }),
    );
  }

  /**
   * Shared ETag flow for per-user lists (/me/hearts and /me/follows).
   *
   * Weak ETag composition: `W/"me-<kind>-<userId>-<count>-<maxCreatedAt>-p<page>-s<size>"`.
   * The userId segment plus the `Vary: Authorization` response header together
   * ensure that proxies / browsers cannot accidentally serve one user's
   * cached list to another. The `maxCreatedAt` reflects the user's OWN heart
   * or follow activity — drift from *other* users' heart bumps on listed
   * idols (heartCount field) is accepted as weak-ETag staleness (documented
   * in ADR-021 Phase D backlog).
   */
  private async handleMyListEtag(
    userId: string,
    q: ListFandomQuery,
    ifNoneMatch: string | undefined,
    res: Response,
    kind: 'hearts' | 'follows',
    getIdentity: (uid: string) => Promise<{ total: number; maxCreatedAt: Date | null }>,
    execute: () => Promise<{ items: { toJSON(): unknown }[]; nextCursor: string | null; total: number }>,
  ): Promise<PaginatedResponseDto<IdolCardDto> | undefined> {
    const identity = await getIdentity(userId);
    const stamp = identity.maxCreatedAt ? identity.maxCreatedAt.getTime() : 0;
    const etag = `W/"me-${kind}-${userId}-${identity.total}-${stamp}-p${q.page}-s${q.size}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    res.setHeader('Vary', 'Authorization');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }

    const result = await execute();
    return {
      items: result.items.map((i) => toCard(i.toJSON() as Parameters<typeof toCard>[0])),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  // Idempotent helper: toggle until the state matches `want`.
  // Worst case runs the tx twice (when the client's view is stale).
  private async ensureTargetState(
    userId: string,
    idolId: string,
    want: boolean,
    kind: 'heart' | 'follow',
  ): Promise<{ state: boolean; count: number }> {
    const first =
      kind === 'heart'
        ? await this.toggleHeart.execute({ userId, idolId })
        : await this.toggleFollow.execute({ userId, idolId });
    const firstState = kind === 'heart' ? (first as { hearted: boolean }).hearted : (first as { following: boolean }).following;
    const firstCount = kind === 'heart' ? (first as { heartCount: number }).heartCount : (first as { followCount: number }).followCount;
    if (firstState === want) return { state: firstState, count: firstCount };

    const second =
      kind === 'heart'
        ? await this.toggleHeart.execute({ userId, idolId })
        : await this.toggleFollow.execute({ userId, idolId });
    const secondState = kind === 'heart' ? (second as { hearted: boolean }).hearted : (second as { following: boolean }).following;
    const secondCount = kind === 'heart' ? (second as { heartCount: number }).heartCount : (second as { followCount: number }).followCount;
    return { state: secondState, count: secondCount };
  }
}
