import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdolCardDto, PaginatedResponseDto } from '@a-idol/shared';
import { ListIdolsUseCase } from '../application/list-idols.usecase';
import { ListIdolsQuery } from './dto/list-idols.dto';

@ApiTags('catalog')
@Controller('idols')
export class CatalogController {
  constructor(private readonly list: ListIdolsUseCase) {}

  @Get()
  @ApiOperation({ summary: 'List published idols' })
  async getIdols(@Query() q: ListIdolsQuery): Promise<PaginatedResponseDto<IdolCardDto>> {
    const res = await this.list.execute({ page: q.page, size: q.size, sort: q.sort });
    return {
      items: res.items.map((i) => {
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
      nextCursor: res.nextCursor,
      total: res.total,
    };
  }
}
