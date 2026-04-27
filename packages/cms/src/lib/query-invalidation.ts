import type { QueryClient } from '@tanstack/react-query';
import { QK } from './query-keys';
import { invalidateEtagCache } from './api';

/**
 * Helpers that encapsulate "after mutation X, which query keys go stale?"
 * Mutations across the CMS should call these instead of invalidating one
 * query key at a time — catches cross-entity effects (e.g. agency rename
 * must refresh the idol list because rows embed `agencyName`).
 *
 * Each helper also drops the corresponding `apiFetch` ETag cache entries
 * so conditional GETs don't short-circuit with a stale body.
 */

export function invalidateAfterIdolChange(qc: QueryClient, idolId?: string): void {
  void qc.invalidateQueries({ queryKey: QK.idols });
  if (idolId) void qc.invalidateQueries({ queryKey: QK.idolDetail(idolId) });
  // Dashboard counters reference idols — cheap to refetch.
  void qc.invalidateQueries({ queryKey: QK.analyticsOverview });
  invalidateEtagCache();
}

export function invalidateAfterAgencyChange(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.agencies });
  // Idol rows carry `agencyName` — any agency mutation stales them.
  void qc.invalidateQueries({ queryKey: QK.idols });
  invalidateEtagCache();
}

export function invalidateAfterAuditionChange(
  qc: QueryClient,
  auditionId?: string,
): void {
  void qc.invalidateQueries({ queryKey: QK.auditions });
  if (auditionId) void qc.invalidateQueries({ queryKey: QK.auditionDetail(auditionId) });
  invalidateEtagCache();
}

export function invalidateAfterRoundChange(
  qc: QueryClient,
  auditionId: string,
  roundId?: string,
): void {
  // Round transitions bump audition.updatedAt (write-through, ADR-021), so
  // the audition detail is the primary invalidation target.
  void qc.invalidateQueries({ queryKey: QK.auditionDetail(auditionId) });
  void qc.invalidateQueries({ queryKey: QK.auditions });
  if (roundId) void qc.invalidateQueries({ queryKey: QK.voteRule(roundId) });
  invalidateEtagCache();
}

export function invalidateAfterProductChange(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.products });
  void qc.invalidateQueries({ queryKey: QK.analyticsOverview });
  invalidateEtagCache();
}

export function invalidateAfterPhotocardSetChange(qc: QueryClient, setId?: string): void {
  void qc.invalidateQueries({ queryKey: QK.photocardSets });
  if (setId) void qc.invalidateQueries({ queryKey: QK.photocardSetDetail(setId) });
  invalidateEtagCache();
}

export function invalidateAfterAutoMessageChange(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: QK.autoMessages });
  invalidateEtagCache();
}
