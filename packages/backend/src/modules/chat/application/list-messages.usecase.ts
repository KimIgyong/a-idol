import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type {
  ChatMessageRepository,
  ChatRoomRepository,
} from './interfaces';
import { CHAT_MESSAGE_REPOSITORY, CHAT_ROOM_REPOSITORY } from './interfaces';
import type { ChatMessage } from '../domain/chat-message';

@Injectable()
export class ListMessagesUseCase {
  constructor(
    @Inject(CHAT_ROOM_REPOSITORY) private readonly rooms: ChatRoomRepository,
    @Inject(CHAT_MESSAGE_REPOSITORY) private readonly messages: ChatMessageRepository,
  ) {}

  async execute(input: {
    userId: string;
    roomId: string;
    take: number;
    before?: Date;
  }): Promise<ChatMessage[]> {
    const room = await this.rooms.findById(input.roomId);
    if (!room || !room.belongsTo(input.userId)) {
      throw new DomainError(ErrorCodes.CHAT_ROOM_NOT_FOUND, 'Chat room not found');
    }
    return this.messages.listByRoom(input.roomId, {
      take: Math.min(Math.max(input.take, 1), 100),
      before: input.before,
    });
  }
}
