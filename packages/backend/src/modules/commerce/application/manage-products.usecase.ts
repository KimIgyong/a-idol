import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { ProductKind } from '@a-idol/shared';
import type { ProductRecord, ProductRepository } from './interfaces';
import { PRODUCT_REPOSITORY } from './interfaces';

@Injectable()
export class CreateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
  ) {}

  async execute(input: {
    sku: string;
    kind: ProductKind;
    title: string;
    description?: string | null;
    priceKrw: number;
    deliveryPayload: Record<string, unknown>;
  }): Promise<ProductRecord> {
    if (await this.repo.findBySku(input.sku)) {
      throw new DomainError(ErrorCodes.PRODUCT_SKU_TAKEN, 'SKU already in use');
    }
    if (input.priceKrw < 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'priceKrw must be non-negative',
      );
    }
    return this.repo.create({
      sku: input.sku.trim(),
      kind: input.kind,
      title: input.title.trim(),
      description: input.description?.trim() ?? null,
      priceKrw: input.priceKrw,
      deliveryPayload: input.deliveryPayload,
    });
  }
}

@Injectable()
export class UpdateProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly repo: ProductRepository,
  ) {}

  async execute(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      priceKrw?: number;
      deliveryPayload?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<ProductRecord> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new DomainError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found');
    if (patch.priceKrw !== undefined && patch.priceKrw < 0) {
      throw new DomainError(
        ErrorCodes.INVALID_DELIVERY_PAYLOAD,
        'priceKrw must be non-negative',
      );
    }
    return this.repo.update(id, patch);
  }
}
