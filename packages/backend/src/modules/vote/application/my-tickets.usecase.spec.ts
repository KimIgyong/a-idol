import { GetMyTicketsUseCase } from './my-tickets.usecase';
import type {
  RoundVoteTicketBalanceRecord,
  VoteTicketBalanceRecord,
  VoteTicketRepository,
} from './ticket-interfaces';

/** T-084 — get-my-tickets: global + round-scoped balances 동시 조회. */
describe('GetMyTicketsUseCase', () => {
  const NOW = new Date('2026-04-28T00:00:00Z');

  const makeRepo = (
    global: VoteTicketBalanceRecord,
    rounds: RoundVoteTicketBalanceRecord[],
  ) => {
    const tickets: VoteTicketRepository = {
      getOrInitBalance: jest.fn(async () => global),
      listRoundBalances: jest.fn(async () => rounds),
      grant: jest.fn(),
      grantRound: jest.fn(),
      consumeOne: jest.fn(),
      refundOne: jest.fn(),
    };
    return { tickets };
  };

  it('TC-MT-001 — global + 빈 rounds', async () => {
    const { tickets } = makeRepo({ userId: 'u-1', balance: 5, updatedAt: NOW }, []);
    const uc = new GetMyTicketsUseCase(tickets);
    const out = await uc.execute('u-1');
    expect(out.global.balance).toBe(5);
    expect(out.rounds).toEqual([]);
  });

  it('TC-MT-002 — global + 여러 round-scoped', async () => {
    const { tickets } = makeRepo(
      { userId: 'u-1', balance: 10, updatedAt: NOW },
      [
        { userId: 'u-1', roundId: 'r-1', balance: 3, updatedAt: NOW },
        { userId: 'u-1', roundId: 'r-2', balance: 7, updatedAt: NOW },
      ],
    );
    const uc = new GetMyTicketsUseCase(tickets);
    const out = await uc.execute('u-1');
    expect(out.global.balance).toBe(10);
    expect(out.rounds).toHaveLength(2);
    expect(out.rounds.map((r) => r.roundId)).toEqual(['r-1', 'r-2']);
  });

  it('TC-MT-003 — repo 메서드 양쪽 모두 호출 (Promise.all)', async () => {
    const { tickets } = makeRepo({ userId: 'u-1', balance: 0, updatedAt: NOW }, []);
    const uc = new GetMyTicketsUseCase(tickets);
    await uc.execute('u-1');
    expect(tickets.getOrInitBalance).toHaveBeenCalledWith('u-1');
    expect(tickets.listRoundBalances).toHaveBeenCalledWith('u-1');
  });
});
