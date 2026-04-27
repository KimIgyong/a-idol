import { Inject, Injectable, Logger } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  AutoMessageRecord,
  AutoMessageRepository,
} from './auto-message-interfaces';
import { AUTO_MESSAGE_REPOSITORY } from './auto-message-interfaces';
import type {
  ChatMessageRepository,
  ChatRoomRepository,
} from './interfaces';
import {
  CHAT_MESSAGE_REPOSITORY,
  CHAT_ROOM_REPOSITORY,
} from './interfaces';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatGateway } from '../presentation/chat.gateway';
import { toChatMessageDto } from '../presentation/dto/chat-view';

/**
 * Executed by the BullMQ processor at `scheduledAt`.
 *
 * For every active fan-club member of the target idol:
 *   1) ensure a ChatRoom exists (open it lazily)
 *   2) append one idol message with the template content
 *   3) broadcast via WS so any connected clients receive it in real time
 *
 * Failures for individual members are logged; overall template status is
 * DISPATCHED if at least one recipient got the message, FAILED otherwise.
 */
@Injectable()
export class DispatchAutoMessageUseCase {
  private readonly log = new Logger(DispatchAutoMessageUseCase.name);

  constructor(
    @Inject(AUTO_MESSAGE_REPOSITORY) private readonly templates: AutoMessageRepository,
    @Inject(CHAT_ROOM_REPOSITORY) private readonly rooms: ChatRoomRepository,
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepository,
    private readonly prisma: PrismaService,
    private readonly gateway: ChatGateway,
  ) {}

  async execute(templateId: string): Promise<AutoMessageRecord> {
    const template = await this.templates.findById(templateId);
    if (!template) {
      throw new DomainError(ErrorCodes.AUTO_MESSAGE_NOT_FOUND, 'Auto-message not found');
    }
    if (template.status === 'DISPATCHED' || template.status === 'CANCELED') {
      // Idempotent: already handled → nothing to do.
      return template;
    }

    // Find all active fan-club members for this idol.
    const members = await this.prisma.membership.findMany({
      where: { leftAt: null, fanClub: { idolId: template.idolId } },
      select: { userId: true },
    });

    let delivered = 0;
    for (const m of members) {
      try {
        const room = await this.rooms.upsertOpen(m.userId, template.idolId);
        const msg = await this.messages.append({
          roomId: room.id,
          senderType: 'idol',
          content: template.content,
        });
        await this.rooms.touchLastMessage(room.id, msg.createdAt);
        this.gateway.broadcastMessage(room.id, toChatMessageDto(msg));
        delivered += 1;
      } catch (err) {
        this.log.warn(
          `auto-message ${templateId} failed for user ${m.userId}: ${(err as Error).message}`,
        );
      }
    }

    return this.templates.updateStatus(templateId, {
      status: delivered > 0 ? 'DISPATCHED' : 'FAILED',
      dispatchedAt: new Date(),
      recipients: delivered,
      failedReason: delivered === 0 ? 'no deliveries (0 active members or all failed)' : null,
    });
  }
}
