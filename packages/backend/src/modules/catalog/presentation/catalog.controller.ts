import { Controller, Get, Headers, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { IdolCardDto, IdolDetailDto, PaginatedResponseDto } from '@a-idol/shared';
import { ListIdolsUseCase } from '../application/list-idols.usecase';
import { GetIdolDetailUseCase } from '../application/get-idol-detail.usecase';
import { ListIdolsQuery } from './dto/list-idols.dto';

/**
 * Weak ETag for /idols list. Composed of:
 *   - dataset identity (total rows + max updatedAt) — changes whenever any
 *     row is added/removed/updated (including heartCount/followCount bumps
 *     via Prisma @updatedAt).
 *   - request shape (page/size/sort) — so a stray If-None-Match from one
 *     URL can't short-circuit another URL on a misbehaving client.
 * Weak (`W/`) because we don't promise byte-identical payloads across
 * compression / proxy rewrites.
 */
function buildIdolsListEtag(
  identity: { total: number; maxUpdatedAt: Date | null },
  req: { page: number; size: number; sort: string },
): string {
  const stamp = identity.maxUpdatedAt ? identity.maxUpdatedAt.getTime() : 0;
  return `W/"idols-${identity.total}-${stamp}-p${req.page}-s${req.size}-${req.sort}"`;
}

@ApiTags('catalog')
@Controller('idols')
export class CatalogController {
  constructor(
    private readonly list: ListIdolsUseCase,
    private readonly detail: GetIdolDetailUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List published idols' })
  async getIdols(
    @Query() q: ListIdolsQuery,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponseDto<IdolCardDto> | undefined> {
    // Cheap identity probe first — two light queries (count + aggregate).
    // If the client's cached ETag matches, short-circuit before paying the
    // findMany + entity construction + JSON serialization cost.
    const identity = await this.list.getIdentity();
    const etag = buildIdolsListEtag(identity, { page: q.page, size: q.size, sort: q.sort });
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }

    const result = await this.list.execute({ page: q.page, size: q.size, sort: q.sort });
    return {
      items: result.items.map((i) => {
        const row = i.toJSON() as {
          id: string;
          name: string;
          stageName: string | null;
          heroImageUrl: string | null;
          heartCount: number;
          followCount: number;
          publishedAt: Date | null;
        };
        return {
          id: row.id,
          name: row.name,
          stageName: row.stageName,
          heroImageUrl: row.heroImageUrl,
          heartCount: row.heartCount,
          followCount: row.followCount,
          publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
        };
      }),
      nextCursor: result.nextCursor,
      total: result.total,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Idol detail including profile JSON + images' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async getIdol(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<IdolDetailDto | undefined> {
    const row = await this.detail.execute(id);
    // Loaded-data ETag — idol.updatedAt handles idol-level edits
    // (heartCount/followCount bumps, admin patches); images.length catches
    // image add/remove since IdolImage has no updatedAt column to aggregate.
    // Consistent with the /auditions/:id loaded-data pattern (ADR-021).
    const etag = `W/"idol-${id}-${row.updatedAt.getTime()}-i${row.images.length}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }

    const i = row.idol.toJSON() as {
      id: string;
      agencyId: string;
      name: string;
      stageName: string | null;
      heroImageUrl: string | null;
      heartCount: number;
      followCount: number;
      publishedAt: Date | null;
    };
    return {
      id: i.id,
      agencyId: i.agencyId,
      name: i.name,
      stageName: i.stageName,
      birthdate: row.birthdate ? row.birthdate.toISOString().slice(0, 10) : null,
      mbti: row.mbti,
      bio: row.bio,
      heroImageUrl: i.heroImageUrl,
      heartCount: i.heartCount,
      followCount: i.followCount,
      publishedAt: i.publishedAt ? i.publishedAt.toISOString() : null,
      profile: row.profile,
      images: row.images,
    };
  }
}
