import { ListMessagesUseCase } from './list-messages.usecase';
import { ChatRoom } from '../domain/chat-room';
import { ChatMessage } from '../domain/chat-message';
import type { ChatMessageRepository, ChatRoomRepository } from './interfaces';

/** T-084 — list-messages: 룸 소유권 가드 + take 클램프. */
describe('ListMessagesUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeRoom = (userId: string) =>
    ChatRoom.create({
      id: 'room-1',
      userId,
      idolId: 'i-1',
      createdAt: NOW,
      lastMessageAt: null,
    });

  const makeMessage = (id: string) =>
    ChatMessage.create({
      id,
      roomId: 'room-1',
      senderType: 'user',
      content: 'msg',
      createdAt: NOW,
    });

  const makeDeps = (room: ChatRoom | null) => {
    let lastListOpts: { take: number; before?: Date } | null = null;
    const rooms: ChatRoomRepository = {
      findByUserAndIdol: jest.fn(),
      findById: jest.fn(async () => room),
      upsertOpen: jest.fn(),
      listByUser: jest.fn(),
      touchLastMessage: jest.fn(),
    };
    const messages: ChatMessageRepository = {
      append: jest.fn(),
      listByRoom: jest.fn(async (_id, opts) => {
        lastListOpts = opts;
        return [makeMessage('m-1'), makeMessage('m-2')];
      }),
    };
    return { rooms, messages, getListOpts: () => lastListOpts };
  };

  it('TC-LM-001 — room 미존재 → CHAT_ROOM_NOT_FOUND', async () => {
    const { rooms, messages } = makeDeps(null);
    const uc = new ListMessagesUseCase(rooms, messages);
    await expect(
      uc.execute({ userId: 'u-1', roomId: 'missing', take: 50 }),
    ).rejects.toMatchObject({ code: 'CHAT_ROOM_NOT_FOUND' });
  });

  it('TC-LM-002 — 룸 소유주 아님 → CHAT_ROOM_NOT_FOUND (privacy)', async () => {
    const { rooms, messages } = makeDeps(makeRoom('other-user'));
    const uc = new ListMessagesUseCase(rooms, messages);
    await expect(
      uc.execute({ userId: 'u-1', roomId: 'room-1', take: 50 }),
    ).rejects.toMatchObject({ code: 'CHAT_ROOM_NOT_FOUND' });
  });

  it('TC-LM-003 — 정상: messages 반환', async () => {
    const { rooms, messages } = makeDeps(makeRoom('u-1'));
    const uc = new ListMessagesUseCase(rooms, messages);
    const out = await uc.execute({ userId: 'u-1', roomId: 'room-1', take: 50 });
    expect(out).toHaveLength(2);
  });

  it('TC-LM-004 — take>100 클램프 → 100', async () => {
    const { rooms, messages, getListOpts } = makeDeps(makeRoom('u-1'));
    const uc = new ListMessagesUseCase(rooms, messages);
    await uc.execute({ userId: 'u-1', roomId: 'room-1', take: 9999 });
    expect(getListOpts()?.take).toBe(100);
  });

  it('TC-LM-005 — take<1 클램프 → 1', async () => {
    const { rooms, messages, getListOpts } = makeDeps(makeRoom('u-1'));
    const uc = new ListMessagesUseCase(rooms, messages);
    await uc.execute({ userId: 'u-1', roomId: 'room-1', take: 0 });
    expect(getListOpts()?.take).toBe(1);
  });

  it('TC-LM-006 — before pagination cursor 그대로 전달', async () => {
    const { rooms, messages, getListOpts } = makeDeps(makeRoom('u-1'));
    const uc = new ListMessagesUseCase(rooms, messages);
    const before = new Date('2026-04-28T12:00:00Z');
    await uc.execute({ userId: 'u-1', roomId: 'room-1', take: 50, before });
    expect(getListOpts()?.before).toBe(before);
  });
});
