import { OpenRoomUseCase } from './open-room.usecase';
import type { ChatMembershipChecker, ChatRoomRepository } from './interfaces';
import type { ChatRoom } from '../domain/chat-room';

/** T-084 — OpenRoom use case. fan-club 멤버십 게이트 검증. */
describe('OpenRoomUseCase', () => {
  const NOW = new Date('2026-04-27T00:00:00Z');

  const makeRoom = (overrides: Partial<ChatRoom> = {}): ChatRoom =>
    ({
      id: 'r-1',
      userId: 'u-1',
      idolId: 'i-1',
      createdAt: NOW,
      lastMessageAt: null,
      ...overrides,
    }) as ChatRoom;

  const makeRepos = (isMember: boolean) => {
    const upserted: Array<{ userId: string; idolId: string }> = [];
    const rooms: ChatRoomRepository = {
      upsertOpen: jest.fn(async (userId, idolId) => {
        upserted.push({ userId, idolId });
        return makeRoom({ userId, idolId });
      }),
      findByUserAndIdol: jest.fn(),
      findById: jest.fn(),
      touchLastMessageAt: jest.fn(),
    } as unknown as ChatRoomRepository;
    const gate: ChatMembershipChecker = {
      isActiveMember: jest.fn(async () => isMember),
    };
    return { rooms, gate, upserted };
  };

  it('TC-OR-001 — 멤버 시 upsertOpen 호출 + 방 반환', async () => {
    const { rooms, gate, upserted } = makeRepos(true);
    const uc = new OpenRoomUseCase(rooms, gate);
    const out = await uc.execute({ userId: 'u-1', idolId: 'i-1' });
    expect(out.userId).toBe('u-1');
    expect(out.idolId).toBe('i-1');
    expect(upserted).toEqual([{ userId: 'u-1', idolId: 'i-1' }]);
  });

  it('TC-OR-002 — 비멤버 시 CHAT_GATE_NOT_MEMBER + upsert 호출 안 함', async () => {
    const { rooms, gate, upserted } = makeRepos(false);
    const uc = new OpenRoomUseCase(rooms, gate);
    await expect(
      uc.execute({ userId: 'u-1', idolId: 'i-1' }),
    ).rejects.toMatchObject({ code: 'CHAT_GATE_NOT_MEMBER' });
    expect(upserted).toEqual([]);
  });

  it('TC-OR-003 — gate 가 isActiveMember 를 정확한 인자로 호출', async () => {
    const { rooms, gate } = makeRepos(true);
    const uc = new OpenRoomUseCase(rooms, gate);
    await uc.execute({ userId: 'u-2', idolId: 'i-9' });
    expect(gate.isActiveMember).toHaveBeenCalledWith('u-2', 'i-9');
  });
});
