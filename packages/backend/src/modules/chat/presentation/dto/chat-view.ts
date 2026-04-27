import type { ChatMessageDto, ChatRoomDto } from '@a-idol/shared';
import type { ChatRoom } from '../../domain/chat-room';
import type { ChatMessage } from '../../domain/chat-message';

export function toChatRoomDto(r: ChatRoom): ChatRoomDto {
  return {
    id: r.id,
    idolId: r.idolId,
    userId: r.userId,
    createdAt: r.createdAt.toISOString(),
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
  };
}

export function toChatMessageDto(m: ChatMessage): ChatMessageDto {
  return {
    id: m.id,
    roomId: m.roomId,
    senderType: m.senderType,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  };
}
