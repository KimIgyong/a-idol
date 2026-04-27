import { Inject, Injectable } from '@nestjs/common';
import type {
  RoundVoteTicketBalanceRecord,
  VoteTicketBalanceRecord,
  VoteTicketRepository,
} from './ticket-interfaces';
import { VOTE_TICKET_REPOSITORY } from './ticket-interfaces';

export interface MyTicketsView {
  global: VoteTicketBalanceRecord;
  rounds: RoundVoteTicketBalanceRecord[];
}

@Injectable()
export class GetMyTicketsUseCase {
  constructor(
    @Inject(VOTE_TICKET_REPOSITORY) private readonly tickets: VoteTicketRepository,
  ) {}

  async execute(userId: string): Promise<MyTicketsView> {
    const [global, rounds] = await Promise.all([
      this.tickets.getOrInitBalance(userId),
      this.tickets.listRoundBalances(userId),
    ]);
    return { global, rounds };
  }
}
