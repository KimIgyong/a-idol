import { BadRequestException, Controller, Get, Headers, Param, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuditionDto, AuditionListItemDto } from '@a-idol/shared';
import type { AuditionDetailRecord } from '../application/interfaces';
import {
  GetAuditionUseCase,
  ListAuditionsUseCase,
} from '../application/audition.usecases';
import { toAuditionDto, toAuditionListItemDto } from './dto/audition-view';

/**
 * Weak ETag for /auditions/:id. Composed from the audition's own updatedAt +
 * round count + entry elimination stamps — the three signals that mobile
 * clients care about (audition status flip, round added, entry eliminated).
 *
 * CAVEAT: round status/endAt transitions that don't bump audition.updatedAt
 * won't invalidate this ETag on their own. That's acceptable because (a)
 * admin round transitions are rare, (b) clients refresh naturally. If
 * staleness becomes a real problem, add write-through bumps in the admin
 * round usecases (parallel to UpdateIdolUseCase invalidation).
 */
function buildAuditionDetailEtag(id: string, detail: AuditionDetailRecord): string {
  let max = detail.updatedAt.getTime();
  for (const e of detail.entries) {
    const t = e.eliminatedAt?.getTime() ?? 0;
    if (t > max) max = t;
  }
  return `W/"audition-${id}-${max}-r${detail.rounds.length}-e${detail.entries.length}"`;
}

@ApiTags('audition')
@Controller('auditions')
export class PublicAuditionController {
  constructor(
    private readonly list: ListAuditionsUseCase,
    private readonly detail: GetAuditionUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List ACTIVE (default) or FINISHED auditions (public)' })
  async getList(
    @Query('status') status?: string,
  ): Promise<AuditionListItemDto[]> {
    // SCR-012 — `?status=FINISHED` 로 지난 오디션 보기. 미지정 시 ACTIVE.
    // DRAFT / CANCELED 는 admin 전용 — public surface 차단.
    const requested = (status ?? 'ACTIVE').toUpperCase();
    if (requested !== 'ACTIVE' && requested !== 'FINISHED') {
      throw new BadRequestException(`status must be ACTIVE or FINISHED`);
    }
    const rows =
      requested === 'FINISHED'
        ? await this.list.executeFinished()
        : await this.list.executePublic();
    return rows.map(toAuditionListItemDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Audition detail (public; ACTIVE only)' })
  async getDetail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuditionDto | undefined> {
    const d = await this.detail.execute(id, { publicOnly: true });
    const etag = buildAuditionDetailEtag(id, d);
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');

    if (ifNoneMatch && ifNoneMatch === etag) {
      res.status(304);
      return undefined;
    }
    return toAuditionDto(d);
  }
}
