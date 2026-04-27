import { ErrorCodes } from '@a-idol/shared';
import { ChatRoom } from '../domain/chat-room';
import { ChatMessage } from '../domain/chat-message';
import { SendMessageUseCase } from './send-message.usecase';
import { ConsumeQuotaOrCouponUseCase } from './consume-quota-or-coupon.usecase';
import type {
  ChatMembershipChecker,
  ChatMessageRepository,
  ChatRoomRepository,
  IdolReplyEngine,
} from './interfaces';
import type { ChatBillingRepository } from './coupon-interfaces';

const room = ChatRoom.create({
  id: 'room-1',
  userId: 'user-1',
  idolId: 'idol-1',
  createdAt: new Date(),
  lastMessageAt: null,
});

function makeDeps(opts: { isMember?: boolean; room?: ChatRoom | null } = {}) {
  const rooms: ChatRoomRepository = {
    findById: jest.fn(async () => opts.room ?? room),
    findByUserAndIdol: jest.fn(async () => opts.room ?? room),
    upsertOpen: jest.fn(async () => room),
    listByUser: jest.fn(),
    touchLastMessage: jest.fn(async () => undefined),
  };
  let idx = 0;
  const messages: ChatMessageRepository = {
    append: jest.fn(async (input) => {
      idx += 1;
      return ChatMessage.create({
        id: `m-${idx}`,
        roomId: input.roomId,
        senderType: input.senderType,
        content: input.content,
        createdAt: new Date(),
      });
    }),
    listByRoom: jest.fn(),
  };
  const gate: ChatMembershipChecker = {
    isActiveMember: jest.fn(async () => opts.isMember ?? true),
  };
  const reply: IdolReplyEngine = {
    reply: jest.fn(async () => '자동 응답'),
  };
  // Always-succeed billing (quota source) so SendMessage tests focus on
  // their own rules. Dedicated coupon/billing tests cover exhaustion paths.
  const billing: ChatBillingRepository = {
    getOrInitQuota: jest.fn(),
    getOrInitWallet: jest.fn(),
    consumeOne: jest.fn(async () => ({
      source: 'quota' as const,
      quotaAfter: { userId: 'u', messagesToday: 1, dailyLimit: 5, lastResetAt: new Date() },
      walletAfter: { userId: 'u', balance: 0 },
    })),
    adjustWallet: jest.fn(),
    listLedger: jest.fn(async () => []),
  };
  const consume = new ConsumeQuotaOrCouponUseCase(billing);
  return { rooms, messages, gate, reply, consume };
}

describe('SendMessageUseCase', () => {
  it('TC-CHAT001 — happy path: appends user + idol messages, touches lastMessage', async () => {
    const d = makeDeps();
    const uc = new SendMessageUseCase(d.rooms, d.messages, d.gate, d.reply, d.consume);
    const res = await uc.execute({ userId: 'user-1', roomId: 'room-1', content: 'hi' });
    expect(res.userMessage.senderType).toBe('user');
    expect(res.idolReply.senderType).toBe('idol');
    expect(res.idolReply.content).toBe('자동 응답');
    expect(d.rooms.touchLastMessage).toHaveBeenCalledWith('room-1', expect.any(Date));
  });

  it('TC-CHAT002 — rejects wrong owner with CHAT_ROOM_NOT_FOUND (no leak)', async () => {
    const d = makeDeps();
    const uc = new SendMessageUseCase(d.rooms, d.messages, d.gate, d.reply, d.consume);
    await expect(
      uc.execute({ userId: 'intruder', roomId: 'room-1', content: 'hi' }),
    ).rejects.toMatchObject({ code: ErrorCodes.CHAT_ROOM_NOT_FOUND });
    expect(d.messages.append).not.toHaveBeenCalled();
  });

  it('TC-CHAT003 — rejects non-member with CHAT_GATE_NOT_MEMBER', async () => {
    const d = makeDeps({ isMember: false });
    const uc = new SendMessageUseCase(d.rooms, d.messages, d.gate, d.reply, d.consume);
    await expect(
      uc.execute({ userId: 'user-1', roomId: 'room-1', content: 'hi' }),
    ).rejects.toMatchObject({ code: ErrorCodes.CHAT_GATE_NOT_MEMBER });
  });

  it('TC-CHAT004 — rejects empty/whitespace-only content', async () => {
    const d = makeDeps();
    const uc = new SendMessageUseCase(d.rooms, d.messages, d.gate, d.reply, d.consume);
    await expect(
      uc.execute({ userId: 'user-1', roomId: 'room-1', content: '   ' }),
    ).rejects.toMatchObject({ code: 'CHAT_MESSAGE_EMPTY' });
  });

  it('TC-CHAT005 — rejects oversized content with CHAT_MESSAGE_TOO_LONG', async () => {
    const d = makeDeps();
    const uc = new SendMessageUseCase(d.rooms, d.messages, d.gate, d.reply, d.consume);
    const huge = 'x'.repeat(2001);
    await expect(
      uc.execute({ userId: 'user-1', roomId: 'room-1', content: huge }),
    ).rejects.toMatchObject({ code: ErrorCodes.CHAT_MESSAGE_TOO_LONG });
  });
});
