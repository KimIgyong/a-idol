import { Injectable } from '@nestjs/common';
import type { ChatSenderType } from '@a-idol/shared';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import { ChatMessage } from '../domain/chat-message';
import type { ChatMessageRepository } from '../application/interfaces';

type MessageRow = {
  id: string;
  roomId: string;
  senderType: ChatSenderType;
  content: string;
  createdAt: Date;
};

@Injectable()
export class PrismaChatMessageRepository implements ChatMessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(input: {
    roomId: string;
    senderType: ChatSenderType;
    content: string;
  }): Promise<ChatMessage> {
    const row = await this.prisma.chatMessage.create({
      data: {
        roomId: input.roomId,
        senderType: input.senderType,
        content: input.content,
      },
    });
    return this.toDomain(row);
  }

  async listByRoom(
    roomId: string,
    opts: { take: number; before?: Date },
  ): Promise<ChatMessage[]> {
    const rows = await this.prisma.chatMessage.findMany({
      where: {
        roomId,
        ...(opts.before ? { createdAt: { lt: opts.before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.take,
    });
    // Return chronologically ascending for easier rendering.
    return rows.reverse().map((r) => this.toDomain(r));
  }

  private toDomain(r: MessageRow): ChatMessage {
    return ChatMessage.create({
      id: r.id,
      roomId: r.roomId,
      senderType: r.senderType,
      content: r.content,
      createdAt: r.createdAt,
    });
  }
}
