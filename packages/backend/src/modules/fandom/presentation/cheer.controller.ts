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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CheerDto, PaginatedResponseDto } from '@a-idol/shared';
import { JwtAuthGuard } from '../../../shared/guards/jwt.guard';
import {
  CurrentUser,
  type CurrentUserContext,
} from '../../../shared/decorators/current-user.decorator';
import { CreateCheerUseCase, ListCheersForIdolUseCase } from '../application/cheer.usecases';
import type { CheerRecord } from '../application/interfaces';
import { CreateCheerDto, ListCheersQuery } from './dto/cheer.dto';

function toCheerDto(r: CheerRecord): CheerDto {
  return {
    id: r.id,
    idolId: r.idolId,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    author: {
      userId: r.userId,
      nickname: r.authorNickname,
      avatarUrl: r.authorAvatarUrl,
    },
  };
}

/**
 * 응원댓글 (RPT-260426-C P2 SCR-006).
 *
 *  - `POST /api/v1/idols/:id/cheers` — 인증 필수, idol publish 상태 검증 (repo).
 *  - `GET /api/v1/idols/:id/cheers` — 공개 read, 페이지네이션.
 *
 * 모더레이션 정책 (금칙어/스팸/신고)은 별도 ADR — 본 controller는 텍스트
 * 그대로 반환. Phase E에서 `Cheer` 모델에 `hidden`/`reportedAt` 컬럼 추가
 * 가능 (현재는 단순 표시).
 */
@ApiTags('cheers')
@Controller('idols/:id/cheers')
export class CheerController {
  constructor(
    private readonly createCheer: CreateCheerUseCase,
    private readonly listCheers: ListCheersForIdolUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '응원댓글 작성 (인증 필요)' })
  async post(
    @CurrentUser() user: CurrentUserContext,
    @Param('id', new ParseUUIDPipe()) idolId: string,
    @Body() body: CreateCheerDto,
  ): Promise<CheerDto> {
    const r = await this.createCheer.execute({
      userId: user.id,
      idolId,
      message: body.message,
    });
    return toCheerDto(r);
  }

  @Get()
  @ApiOperation({ summary: '응원댓글 목록 (공개)' })
  async list(
    @Param('id', new ParseUUIDPipe()) idolId: string,
    @Query() q: ListCheersQuery,
  ): Promise<PaginatedResponseDto<CheerDto>> {
    const res = await this.listCheers.execute({ idolId, page: q.page, size: q.size });
    return {
      items: res.items.map(toCheerDto),
      nextCursor: res.nextCursor,
      total: res.total,
    };
  }
}
