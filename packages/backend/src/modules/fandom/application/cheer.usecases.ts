import { Inject, Injectable } from '@nestjs/common';
import type { CheerRecord, CheerRepository } from './interfaces';
import { CHEER_REPOSITORY } from './interfaces';

/**
 * 응원댓글 작성 (RPT-260426-C P2 SCR-006).
 *
 * 검증:
 *  - message는 DTO에서 1~200자 + trim 검증 (class-validator).
 *  - idol은 publish 상태여야 함 (repo `findFirst` 필터로 IDOL_NOT_FOUND 방어).
 *
 * 모더레이션은 별도 ADR — 금칙어/스팸 필터는 Phase E.
 */
@Injectable()
export class CreateCheerUseCase {
  constructor(@Inject(CHEER_REPOSITORY) private readonly repo: CheerRepository) {}

  execute(input: { userId: string; idolId: string; message: string }): Promise<CheerRecord> {
    return this.repo.create({
      userId: input.userId,
      idolId: input.idolId,
      message: input.message.trim(),
    });
  }
}

@Injectable()
export class ListCheersForIdolUseCase {
  constructor(@Inject(CHEER_REPOSITORY) private readonly repo: CheerRepository) {}

  async execute(input: {
    idolId: string;
    page: number;
    size: number;
  }): Promise<{ items: CheerRecord[]; total: number; nextCursor: string | null }> {
    const page = Math.max(input.page, 1);
    const size = Math.min(Math.max(input.size, 1), 50);
    const { items, total } = await this.repo.listByIdol(input.idolId, {
      take: size,
      skip: (page - 1) * size,
    });
    const nextCursor = page * size < total ? String(page + 1) : null;
    return { items, total, nextCursor };
  }
}
