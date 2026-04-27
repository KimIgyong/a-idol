import { ErrorCodes } from '@a-idol/shared';
import { assertValidWeights } from './vote-rule';

describe('VoteRule weight validator', () => {
  it('TC-VR001 — accepts a mix of positive weights', () => {
    expect(() =>
      assertValidWeights({ heartWeight: 1, smsWeight: 0, ticketWeight: 10, dailyHeartLimit: 3 }),
    ).not.toThrow();
  });

  it('TC-VR002 — rejects all-zero weights', () => {
    expect(() =>
      assertValidWeights({ heartWeight: 0, smsWeight: 0, ticketWeight: 0, dailyHeartLimit: 1 }),
    ).toThrowError(
      expect.objectContaining({ code: ErrorCodes.VOTE_RULE_INVALID_WEIGHTS }),
    );
  });

  it('TC-VR003 — rejects negative weight', () => {
    expect(() =>
      assertValidWeights({ heartWeight: -1, smsWeight: 0, ticketWeight: 10, dailyHeartLimit: 1 }),
    ).toThrowError(
      expect.objectContaining({ code: ErrorCodes.VOTE_RULE_INVALID_WEIGHTS }),
    );
  });

  it('TC-VR004 — rejects zero or negative dailyHeartLimit', () => {
    expect(() =>
      assertValidWeights({ heartWeight: 1, smsWeight: 0, ticketWeight: 0, dailyHeartLimit: 0 }),
    ).toThrow();
    expect(() =>
      assertValidWeights({ heartWeight: 1, smsWeight: 0, ticketWeight: 0, dailyHeartLimit: -3 }),
    ).toThrow();
  });
});
