import { Inject, Injectable } from '@nestjs/common';
import type { ProductRecord, ProductRepository } from './interfaces';
import { PRODUCT_REPOSITORY } from './interfaces';

@Injectable()
export class ListProductsUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
  ) {}

  execute(opts: { activeOnly: boolean }): Promise<ProductRecord[]> {
    return this.repo.list(opts);
  }

  getIdentity(opts: { activeOnly: boolean }) {
    return this.repo.getListIdentity(opts);
  }
}
