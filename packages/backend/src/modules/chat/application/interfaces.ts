import type { ChatSenderType } from '@a-idol/shared';
import type { ChatRoom } from '../domain/chat-room';
import type { ChatMessage } from '../domain/chat-message';

export interface ChatRoomRepository {
  findByUserAndIdol(userId: string, idolId: string): Promise<ChatRoom | null>;
  findById(id: string): Promise<ChatRoom | null>;
  upsertOpen(userId: string, idolId: string): Promise<ChatRoom>;
  listByUser(
    userId: string,
    opts: { take: number; skip: number },
  ): Promise<{ items: ChatRoom[]; total: number }>;
  touchLastMessage(roomId: string, at: Date): Promise<void>;
}

export interface ChatMessageRepository {
  append(input: {
    roomId: string;
    senderType: ChatSenderType;
    content: string;
  }): Promise<ChatMessage>;
  listByRoom(
    roomId: string,
    opts: { take: number; before?: Date },
  ): Promise<ChatMessage[]>;
}

/**
 * Gate check adapter: asks the Fandom context whether a given user is an
 * active member of a given idol's fan club. Keeps the Chat module decoupled
 * from Prisma/Fandom internals.
 */
export interface ChatMembershipChecker {
  isActiveMember(userId: string, idolId: string): Promise<boolean>;
}

/**
 * Auto-reply engine. MVP: pre-seeded response pool + small randomness.
 * Phase 2 (ADR-006): swap implementation for LLM-backed reply.
 */
export interface IdolReplyEngine {
  reply(input: { userMessage: string; idolId: string }): Promise<string>;
}

export const CHAT_ROOM_REPOSITORY = 'ChatRoomRepository';
export const CHAT_MESSAGE_REPOSITORY = 'ChatMessageRepository';
export const CHAT_MEMBERSHIP_CHECKER = 'ChatMembershipChecker';
export const IDOL_REPLY_ENGINE = 'IdolReplyEngine';
