import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { ChatModule } from '../chat/chat.module';
import { VoteModule } from '../vote/vote.module';
import { PhotocardModule } from '../photocard/photocard.module';
import { ListProductsUseCase } from './application/list-products.usecase';
import {
  CreateProductUseCase,
  UpdateProductUseCase,
} from './application/manage-products.usecase';
import { CreatePurchaseUseCase } from './application/create-purchase.usecase';
import { ListMyTransactionsUseCase } from './application/list-my-transactions.usecase';
import {
  PRODUCT_REPOSITORY,
  PURCHASE_FULFILLERS,
  TRANSACTION_REPOSITORY,
  type PurchaseFulfiller,
} from './application/interfaces';
import { PrismaProductRepository } from './infrastructure/prisma-product.repository';
import { PrismaTransactionRepository } from './infrastructure/prisma-transaction.repository';
import { ChatCouponFulfiller } from './infrastructure/chat-coupon.fulfiller';
import { VoteTicketFulfiller } from './infrastructure/vote-ticket.fulfiller';
import { PhotocardPackFulfiller } from './infrastructure/photocard-pack.fulfiller';
import { CommerceController } from './presentation/commerce.controller';
import { AdminCommerceController } from './presentation/admin-commerce.controller';

@Module({
  imports: [IdentityModule, AdminOpsModule, ChatModule, VoteModule, PhotocardModule],
  controllers: [CommerceController, AdminCommerceController],
  providers: [
    ListProductsUseCase,
    CreateProductUseCase,
    UpdateProductUseCase,
    CreatePurchaseUseCase,
    ListMyTransactionsUseCase,
    ChatCouponFulfiller,
    VoteTicketFulfiller,
    PhotocardPackFulfiller,
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: PrismaTransactionRepository },
    {
      provide: PURCHASE_FULFILLERS,
      inject: [ChatCouponFulfiller, VoteTicketFulfiller, PhotocardPackFulfiller],
      // PurchaseFulfillers[] list — add new kinds as fulfillers are written.
      useFactory: (
        coupon: ChatCouponFulfiller,
        voteTicket: VoteTicketFulfiller,
        photocard: PhotocardPackFulfiller,
      ): PurchaseFulfiller[] => [coupon, voteTicket, photocard],
    },
  ],
})
export class CommerceModule {}
