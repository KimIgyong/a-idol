import { computeDropPercents } from './photocard-view';
import type { PhotocardTemplateRecord } from '../../application/interfaces';

const t = (
  id: string,
  dropWeight: number,
  isActive = true,
): PhotocardTemplateRecord => ({
  id,
  setId: 'set-1',
  name: id,
  imageUrl: null,
  rarity: 'COMMON',
  dropWeight,
  isActive,
});

describe('computeDropPercents', () => {
  it('TC-PC001 — simple distribution sums to 100 (to 2dp)', () => {
    const percents = computeDropPercents([t('a', 40), t('b', 40), t('c', 20)]);
    expect(percents.get('a')).toBe(40);
    expect(percents.get('b')).toBe(40);
    expect(percents.get('c')).toBe(20);
    const sum = [...percents.values()].reduce((acc, v) => acc + v, 0);
    expect(sum).toBeCloseTo(100, 2);
  });

  it('TC-PC002 — matches the HYUN seed distribution', () => {
    // mirrors prisma/seed.ts HYUN 1st Photocard Set
    const ps = computeDropPercents([
      t('s1', 40),
      t('s2', 40),
      t('bs', 30),
      t('sf', 30),
      t('mv', 15),
      t('fm', 15),
      t('sp', 6),
      t('dn', 1),
    ]);
    // total weight = 177
    expect(ps.get('s1')).toBeCloseTo(22.6, 1);
    expect(ps.get('dn')).toBeCloseTo(0.56, 1);
    const sum = [...ps.values()].reduce((acc, v) => acc + v, 0);
    expect(sum).toBeGreaterThan(99.9);
    expect(sum).toBeLessThan(100.1);
  });

  it('TC-PC003 — inactive templates reported as 0% and excluded from the total', () => {
    const percents = computeDropPercents([
      t('a', 50),
      t('b', 50),
      t('c', 50, false), // inactive → excluded
    ]);
    expect(percents.get('a')).toBe(50);
    expect(percents.get('b')).toBe(50);
    expect(percents.get('c')).toBe(0);
  });

  it('TC-PC004 — zero-weight templates reported as 0%', () => {
    const percents = computeDropPercents([t('a', 10), t('zero', 0)]);
    expect(percents.get('a')).toBe(100);
    expect(percents.get('zero')).toBe(0);
  });

  it('TC-PC005 — empty / all-inactive set → all templates 0% (does not throw)', () => {
    const emptyPs = computeDropPercents([]);
    expect(emptyPs.size).toBe(0);
    const allInactive = computeDropPercents([t('a', 10, false), t('b', 5, false)]);
    expect(allInactive.get('a')).toBe(0);
    expect(allInactive.get('b')).toBe(0);
  });

  it('TC-PC006 — rounds to 2 decimals', () => {
    // 1 / 3 templates, each weight 1 → 33.3333...% → 33.33 after rounding
    const ps = computeDropPercents([t('a', 1), t('b', 1), t('c', 1)]);
    expect(ps.get('a')).toBe(33.33);
    expect(ps.get('b')).toBe(33.33);
    expect(ps.get('c')).toBe(33.33);
  });
});
