/**
 * Centralized TanStack Query key registry. All admin queries declare their
 * key here so cross-entity invalidation (e.g. an agency rename should
 * refresh the idol list because idol rows show the agency name) has a
 * single source of truth.
 *
 * Convention: each key is a tuple literal so `queryClient.invalidateQueries`
 * matches it and any subtree that extends it (e.g. QK.idols matches
 * ['admin', 'idols', { page: 2 }] too).
 */
export const QK = {
  // Idols
  idols: ['admin', 'idols'] as const,
  idolDetail: (id: string) => ['admin', 'idol', id] as const,

  // Agencies
  agencies: ['admin', 'agencies'] as const,

  // Auditions
  auditions: ['admin', 'auditions'] as const,
  auditionDetail: (id: string) => ['admin', 'audition', id] as const,
  voteRule: (roundId: string) => ['admin', 'vote-rule', roundId] as const,

  // Chat / auto-messages
  autoMessages: ['admin', 'auto-messages'] as const,

  // Commerce
  products: ['admin', 'products'] as const,

  // Photocards
  photocardSets: ['admin', 'photocard-sets'] as const,
  photocardSetDetail: (id: string) => ['admin', 'photocard-set', id] as const,

  // Analytics
  analyticsOverview: ['admin', 'analytics', 'overview'] as const,
};
