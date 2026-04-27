import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IDOL_REPOSITORY, IdolRepository, IdolDetailRow } from './list-idols.usecase';

@Injectable()
export class GetIdolDetailUseCase {
  constructor(@Inject(IDOL_REPOSITORY) private readonly repo: IdolRepository) {}

  async execute(id: string): Promise<IdolDetailRow> {
    const row = await this.repo.findByIdWithDetail(id);
    if (!row) throw new NotFoundException({ code: 'IDOL_NOT_FOUND', message: `Idol not found: ${id}` });
    return row;
  }
}
