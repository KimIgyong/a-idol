import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { AdminOpsModule } from '../admin-ops/admin-ops.module';
import { CatalogModule } from '../catalog/catalog.module';
import {
  AUTO_MESSAGE_QUEUE,
  CHAT_QUOTA_RESET_QUEUE,
} from '../../shared/queue/queue.module';
import { OpenRoomUseCase } from './application/open-room.usecase';
import { SendMessageUseCase } from './application/send-message.usecase';
import { ListMessagesUseCase } from './application/list-messages.usecase';
import { ConsumeQuotaOrCouponUseCase } from './application/consume-quota-or-coupon.usecase';
import { GetChatBalanceUseCase } from './application/get-chat-balance.usecase';
import { GrantCouponUseCase } from './application/grant-coupon.usecase';
import { ScheduleAutoMessageUseCase } from './application/schedule-auto-message.usecase';
import { ListAutoMessagesUseCase } from './application/list-auto-messages.usecase';
import { CancelAutoMessageUseCase } from './application/cancel-auto-message.usecase';
import { DispatchAutoMessageUseCase } from './application/dispatch-auto-message.usecase';
import {
  CHAT_MEMBERSHIP_CHECKER,
  CHAT_MESSAGE_REPOSITORY,
  CHAT_ROOM_REPOSITORY,
  IDOL_REPLY_ENGINE,
} from './application/interfaces';
import { CHAT_BILLING_REPOSITORY } from './application/coupon-interfaces';
import {
  AUTO_MESSAGE_REPOSITORY,
  AUTO_MESSAGE_SCHEDULER,
} from './application/auto-message-interfaces';
import { PrismaChatRoomRepository } from './infrastructure/prisma-chat-room.repository';
import { PrismaChatMessageRepository } from './infrastructure/prisma-chat-message.repository';
import { PrismaMembershipChecker } from './infrastructure/prisma-membership-checker';
import { RuleBasedReplyEngine } from './infrastructure/rule-based-reply-engine';
import { PrismaChatBillingRepository } from './infrastructure/prisma-chat-billing.repository';
import { PrismaAutoMessageRepository } from './infrastructure/prisma-auto-message.repository';
import { BullmqAutoMessageScheduler } from './infrastructure/bullmq-auto-message.scheduler';
import { AutoMessageProcessor } from './infrastructure/auto-message.processor';
import { ChatQuotaResetProcessor } from './infrastructure/chat-quota-reset.processor';
import { ChatController } from './presentation/chat.controller';
import { ChatBalanceController } from './presentation/chat-balance.controller';
import { AdminChatController } from './presentation/admin-chat.controller';
import { AdminAutoMessageController } from './presentation/admin-auto-message.controller';
import { ChatGateway } from './presentation/chat.gateway';

@Module({
  // CatalogModule exposes ADMIN_IDOL_REPOSITORY for ScheduleAutoMessageUseCase.
  imports: [
    IdentityModule,
    AdminOpsModule,
    CatalogModule,
    // Scope-register the queues here so InjectQueue() resolves in this module
    // (forRoot already lives in the global QueueModule).
    BullModule.registerQueue(
      { name: AUTO_MESSAGE_QUEUE },
      { name: CHAT_QUOTA_RESET_QUEUE },
    ),
  ],
  controllers: [
    ChatController,
    ChatBalanceController,
    AdminChatController,
    AdminAutoMessageController,
  ],
  providers: [
    OpenRoomUseCase,
    SendMessageUseCase,
    ListMessagesUseCase,
    ConsumeQuotaOrCouponUseCase,
    GetChatBalanceUseCase,
    GrantCouponUseCase,
    ScheduleAutoMessageUseCase,
    ListAutoMessagesUseCase,
    CancelAutoMessageUseCase,
    DispatchAutoMessageUseCase,
    ChatGateway,
    AutoMessageProcessor,
    ChatQuotaResetProcessor,
    { provide: CHAT_ROOM_REPOSITORY, useClass: PrismaChatRoomRepository },
    { provide: CHAT_MESSAGE_REPOSITORY, useClass: PrismaChatMessageRepository },
    { provide: CHAT_MEMBERSHIP_CHECKER, useClass: PrismaMembershipChecker },
    { provide: IDOL_REPLY_ENGINE, useClass: RuleBasedReplyEngine },
    { provide: CHAT_BILLING_REPOSITORY, useClass: PrismaChatBillingRepository },
    { provide: AUTO_MESSAGE_REPOSITORY, useClass: PrismaAutoMessageRepository },
    { provide: AUTO_MESSAGE_SCHEDULER, useClass: BullmqAutoMessageScheduler },
  ],
  // CommerceModule's ChatCouponFulfiller resolves CHAT_BILLING_REPOSITORY.
  exports: [CHAT_BILLING_REPOSITORY],
})
export class ChatModule {}
