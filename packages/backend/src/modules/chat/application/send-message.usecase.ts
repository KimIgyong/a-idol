import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  ChatMembershipChecker,
  ChatMessageRepository,
  ChatRoomRepository,
  IdolReplyEngine,
} from './interfaces';
import {
  CHAT_MEMBERSHIP_CHECKER,
  CHAT_MESSAGE_REPOSITORY,
  CHAT_ROOM_REPOSITORY,
  IDOL_REPLY_ENGINE,
} from './interfaces';
import type { ChatMessage } from '../domain/chat-message';
import type { ConsumeOutcome } from './coupon-interfaces';
import { ConsumeQuotaOrCouponUseCase } from './consume-quota-or-coupon.usecase';

const MAX_MESSAGE_CHARS = 2000;

export interface SendMessageResult {
  userMessage: ChatMessage;
  idolReply: ChatMessage;
  charged: ConsumeOutcome;
}

@Injectable()
export class SendMessageUseCase {
  constructor(
    @Inject(CHAT_ROOM_REPOSITORY) private readonly rooms: ChatRoomRepository,
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepository,
    @Inject(CHAT_MEMBERSHIP_CHECKER) private readonly gate: ChatMembershipChecker,
    @Inject(IDOL_REPLY_ENGINE) private readonly replyEngine: IdolReplyEngine,
    private readonly consume: ConsumeQuotaOrCouponUseCase,
  ) {}

  async execute(input: {
    userId: string;
    roomId: string;
    content: string;
  }): Promise<SendMessageResult> {
    const trimmed = input.content.trim();
    if (!trimmed) {
      throw new DomainError('CHAT_MESSAGE_EMPTY', 'Message is empty');
    }
    if (trimmed.length > MAX_MESSAGE_CHARS) {
      throw new DomainError(
        ErrorCodes.CHAT_MESSAGE_TOO_LONG,
        `Message exceeds ${MAX_MESSAGE_CHARS} characters`,
      );
    }

    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new DomainError(ErrorCodes.CHAT_ROOM_NOT_FOUND, 'Chat room not found');
    if (!room.belongsTo(input.userId)) {
      // 404 rather than 403 so the existence of the room doesn't leak.
      throw new DomainError(ErrorCodes.CHAT_ROOM_NOT_FOUND, 'Chat room not found');
    }

    // Fan club membership is the gate — if the user leaves the club they
    // lose the ability to send new messages (they keep read access to history).
    const isMember = await this.gate.isActiveMember(room.userId, room.idolId);
    if (!isMember) {
      throw new DomainError(
        ErrorCodes.CHAT_GATE_NOT_MEMBER,
        'Membership required to send messages',
      );
    }

    // Charge one slot (free quota → coupon → NO_COUPON) before persisting.
    // Failure here means nothing is written to the chat log.
    const charged = await this.consume.execute(input.userId);

    const userMessage = await this.messages.append({
      roomId: room.id,
      senderType: 'user',
      content: trimmed,
    });

    const idolText = await this.replyEngine.reply({
      userMessage: trimmed,
      idolId: room.idolId,
    });
    const idolReply = await this.messages.append({
      roomId: room.id,
      senderType: 'idol',
      content: idolText,
    });

    await this.rooms.touchLastMessage(room.id, idolReply.createdAt);

    return { userMessage, idolReply, charged };
  }
}
