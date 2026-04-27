import { Injectable } from '@nestjs/common';
import type { ProductKind } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { ProductRecord, ProductRepository } from '../application/interfaces';

type Row = {
  id: string;
  sku: string;
  kind: ProductKind;
  title: string;
  description: string | null;
  priceKrw: number;
  deliveryPayload: unknown;
  isActive: boolean;
};

@Injectable()
export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: { activeOnly: boolean }): Promise<ProductRecord[]> {
    const rows = await this.prisma.purchaseProduct.findMany({
      where: opts.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ kind: 'asc' }, { priceKrw: 'asc' }],
    });
    return rows.map((r) => this.toRecord(r));
  }

  async getListIdentity(opts: { activeOnly: boolean }): Promise<{ total: number; maxUpdatedAt: Date | null }> {
    const where = opts.activeOnly ? { isActive: true } : undefined;
    const [total, agg] = await this.prisma.$transaction([
      this.prisma.purchaseProduct.count({ where }),
      this.prisma.purchaseProduct.aggregate({ where, _max: { updatedAt: true } }),
    ]);
    return { total, maxUpdatedAt: agg._max.updatedAt ?? null };
  }

  async findById(id: string): Promise<ProductRecord | null> {
    const row = await this.prisma.purchaseProduct.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async findBySku(sku: string): Promise<ProductRecord | null> {
    const row = await this.prisma.purchaseProduct.findUnique({ where: { sku } });
    return row ? this.toRecord(row) : null;
  }

  async create(input: {
    sku: string;
    kind: ProductKind;
    title: string;
    description: string | null;
    priceKrw: number;
    deliveryPayload: Record<string, unknown>;
  }): Promise<ProductRecord> {
    const row = await this.prisma.purchaseProduct.create({
      data: { ...input, deliveryPayload: input.deliveryPayload as object },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    patch: {
      title?: string;
      description?: string | null;
      priceKrw?: number;
      deliveryPayload?: Record<string, unknown>;
      isActive?: boolean;
    },
  ): Promise<ProductRecord> {
    const row = await this.prisma.purchaseProduct.update({
      where: { id },
      data: {
        title: patch.title,
        description: patch.description === undefined ? undefined : patch.description,
        priceKrw: patch.priceKrw,
        deliveryPayload:
          patch.deliveryPayload === undefined
            ? undefined
            : (patch.deliveryPayload as object),
        isActive: patch.isActive,
      },
    });
    return this.toRecord(row);
  }

  private toRecord(row: Row): ProductRecord {
    return {
      id: row.id,
      sku: row.sku,
      kind: row.kind,
      title: row.title,
      description: row.description,
      priceKrw: row.priceKrw,
      deliveryPayload: (row.deliveryPayload ?? {}) as Record<string, unknown>,
      isActive: row.isActive,
    };
  }
}
