import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  PaymentProvider,
  ProductKind,
  TransactionStatus,
} from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type {
  TransactionRecord,
  TransactionRepository,
} from '../application/interfaces';

type Row = {
  id: string;
  userId: string;
  productId: string;
  provider: PaymentProvider;
  providerTxId: string | null;
  status: TransactionStatus;
  priceKrw: number;
  deliverySnapshot: unknown;
  fulfilledAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  product: { sku: string; title: string; kind: ProductKind };
};

@Injectable()
export class PrismaTransactionRepository implements TransactionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    userId: string;
    productId: string;
    provider: PaymentProvider;
    providerTxId: string | null;
    priceKrw: number;
    deliverySnapshot: Record<string, unknown>;
  }): Promise<TransactionRecord> {
    try {
      const row = await this.prisma.purchaseTransaction.create({
        data: {
          userId: input.userId,
          productId: input.productId,
          provider: input.provider,
          providerTxId: input.providerTxId,
          priceKrw: input.priceKrw,
          deliverySnapshot: input.deliverySnapshot as object,
        },
        include: { product: { select: { sku: true, title: true, kind: true } } },
      });
      return this.toRecord(row);
    } catch (err) {
      // (provider, providerTxId) unique constraint — R-03 duplicate-receipt guard.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new DomainError(
          ErrorCodes.DUPLICATE_RECEIPT,
          'This provider transaction has already been recorded',
        );
      }
      throw err;
    }
  }

  async markFulfilled(id: string, at: Date): Promise<TransactionRecord> {
    const row = await this.prisma.purchaseTransaction.update({
      where: { id },
      data: { status: 'FULFILLED', fulfilledAt: at, failedReason: null },
      include: { product: { select: { sku: true, title: true, kind: true } } },
    });
    return this.toRecord(row);
  }

  async markFailed(id: string, reason: string): Promise<TransactionRecord> {
    const row = await this.prisma.purchaseTransaction.update({
      where: { id },
      data: { status: 'FAILED', failedReason: reason },
      include: { product: { select: { sku: true, title: true, kind: true } } },
    });
    return this.toRecord(row);
  }

  async listByUser(userId: string, take: number): Promise<TransactionRecord[]> {
    const rows = await this.prisma.purchaseTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take,
      include: { product: { select: { sku: true, title: true, kind: true } } },
    });
    return rows.map((r) => this.toRecord(r));
  }

  async findById(id: string): Promise<TransactionRecord | null> {
    const row = await this.prisma.purchaseTransaction.findUnique({
      where: { id },
      include: { product: { select: { sku: true, title: true, kind: true } } },
    });
    return row ? this.toRecord(row) : null;
  }

  private toRecord(row: Row): TransactionRecord {
    return {
      id: row.id,
      userId: row.userId,
      productId: row.productId,
      product: row.product,
      provider: row.provider,
      providerTxId: row.providerTxId,
      status: row.status,
      priceKrw: row.priceKrw,
      deliverySnapshot: (row.deliverySnapshot ?? {}) as Record<string, unknown>,
      fulfilledAt: row.fulfilledAt,
      failedReason: row.failedReason,
      createdAt: row.createdAt,
    };
  }
}
