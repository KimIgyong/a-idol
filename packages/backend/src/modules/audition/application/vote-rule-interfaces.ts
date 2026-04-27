export interface VoteRuleRecord {
  roundId: string;
  heartWeight: number;
  smsWeight: number;
  ticketWeight: number;
  dailyHeartLimit: number;
  updatedAt: Date;
}

export interface VoteRuleRepository {
  findByRound(roundId: string): Promise<VoteRuleRecord | null>;
  upsert(input: {
    roundId: string;
    heartWeight: number;
    smsWeight: number;
    ticketWeight: number;
    dailyHeartLimit: number;
  }): Promise<VoteRuleRecord>;
  delete(roundId: string): Promise<void>;
}

export const VOTE_RULE_REPOSITORY = 'VoteRuleRepository';
