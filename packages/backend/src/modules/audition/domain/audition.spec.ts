import { ErrorCodes } from '@a-idol/shared';
import {
  AUDITION_TRANSITIONS,
  assertAuditionDateRange,
  assertAuditionTransition,
} from './audition';
import { ROUND_TRANSITIONS, assertRoundTransition } from './round';

describe('Audition status machine', () => {
  it('TC-AU001 — DRAFT → ACTIVE → FINISHED is the happy path', () => {
    expect(() => assertAuditionTransition('DRAFT', 'ACTIVE')).not.toThrow();
    expect(() => assertAuditionTransition('ACTIVE', 'FINISHED')).not.toThrow();
  });

  it('TC-AU002 — rejects reversals', () => {
    expect(() => assertAuditionTransition('ACTIVE', 'DRAFT')).toThrow();
    expect(() => assertAuditionTransition('FINISHED', 'ACTIVE')).toThrow();
    expect(() => assertAuditionTransition('FINISHED', 'DRAFT')).toThrow();
  });

  it('TC-AU003 — cancel allowed from DRAFT or ACTIVE', () => {
    expect(() => assertAuditionTransition('DRAFT', 'CANCELED')).not.toThrow();
    expect(() => assertAuditionTransition('ACTIVE', 'CANCELED')).not.toThrow();
    expect(() => assertAuditionTransition('CANCELED', 'DRAFT')).toThrow();
    expect(() => assertAuditionTransition('CANCELED', 'ACTIVE')).toThrow();
  });

  it('TC-AU004 — AUDITION_TRANSITIONS table covers all source states', () => {
    const keys: string[] = Object.keys(AUDITION_TRANSITIONS);
    for (const k of ['DRAFT', 'ACTIVE', 'FINISHED', 'CANCELED']) {
      expect(keys).toContain(k);
    }
  });

  it('TC-AU005 — rejects reversed date range', () => {
    const now = new Date('2026-07-01T00:00:00Z');
    const later = new Date('2026-07-02T00:00:00Z');
    expect(() => assertAuditionDateRange(now, later)).not.toThrow();
    expect(() => assertAuditionDateRange(later, now)).toThrow();
    expect(() => assertAuditionDateRange(now, now)).toThrowError(
      expect.objectContaining({ code: ErrorCodes.AUDITION_INVALID_DATE_RANGE }),
    );
  });
});

describe('Round status machine', () => {
  it('TC-RO001 — SCHEDULED → ACTIVE → CLOSED is the only path', () => {
    expect(() => assertRoundTransition('SCHEDULED', 'ACTIVE')).not.toThrow();
    expect(() => assertRoundTransition('ACTIVE', 'CLOSED')).not.toThrow();
  });

  it('TC-RO002 — no back edges', () => {
    expect(() => assertRoundTransition('ACTIVE', 'SCHEDULED')).toThrow();
    expect(() => assertRoundTransition('CLOSED', 'ACTIVE')).toThrow();
    expect(() => assertRoundTransition('CLOSED', 'SCHEDULED')).toThrow();
  });

  it('TC-RO003 — ROUND_TRANSITIONS table covers all states', () => {
    const keys: string[] = Object.keys(ROUND_TRANSITIONS);
    for (const k of ['SCHEDULED', 'ACTIVE', 'CLOSED']) {
      expect(keys).toContain(k);
    }
  });
});
