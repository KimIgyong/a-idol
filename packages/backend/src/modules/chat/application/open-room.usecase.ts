import { Inject, Injectable } from '@nestjs/common';
import { DomainError, ErrorCodes } from '@a-idol/shared';
import type { ChatMembershipChecker, ChatRoomRepository } from './interfaces';
import { CHAT_MEMBERSHIP_CHECKER, CHAT_ROOM_REPOSITORY } from './interfaces';
import type { ChatRoom } from '../domain/chat-room';

@Injectable()
export class OpenRoomUseCase {
  constructor(
    @Inject(CHAT_ROOM_REPOSITORY) private readonly rooms: ChatRoomRepository,
    @Inject(CHAT_MEMBERSHIP_CHECKER) private readonly gate: ChatMembershipChecker,
  ) {}

  async execute(input: { userId: string; idolId: string }): Promise<ChatRoom> {
    const isMember = await this.gate.isActiveMember(input.userId, input.idolId);
    if (!isMember) {
      throw new DomainError(
        ErrorCodes.CHAT_GATE_NOT_MEMBER,
        'Only fan club members can open a chat with this idol',
      );
    }
    return this.rooms.upsertOpen(input.userId, input.idolId);
  }
}
