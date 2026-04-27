import type {
  AuditionDto,
  AuditionEntryDto,
  AuditionListItemDto,
  RoundDto,
} from '@a-idol/shared';
import type {
  AuditionDetailRecord,
  AuditionEntryRecord,
  AuditionListItem,
  RoundRecord,
} from '../../application/interfaces';

export function toRoundDto(r: RoundRecord): RoundDto {
  return {
    id: r.id,
    auditionId: r.auditionId,
    name: r.name,
    orderIndex: r.orderIndex,
    status: r.status,
    startAt: r.startAt.toISOString(),
    endAt: r.endAt.toISOString(),
    maxAdvancers: r.maxAdvancers,
  };
}

export function toEntryDto(e: AuditionEntryRecord): AuditionEntryDto {
  return {
    id: e.id,
    idolId: e.idolId,
    idolName: e.idolName,
    stageName: e.stageName,
    heroImageUrl: e.heroImageUrl,
    eliminatedAt: e.eliminatedAt ? e.eliminatedAt.toISOString() : null,
    eliminatedAtRoundId: e.eliminatedAtRoundId,
  };
}

export function toAuditionDto(a: AuditionDetailRecord): AuditionDto {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    status: a.status,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    createdAt: a.createdAt.toISOString(),
    rounds: a.rounds.map(toRoundDto),
    entries: a.entries.map(toEntryDto),
  };
}

export function toAuditionListItemDto(a: AuditionListItem): AuditionListItemDto {
  return {
    id: a.id,
    name: a.name,
    status: a.status,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    rounds: a.roundCount,
    entries: a.entryCount,
  };
}

import type { VoteRuleDto } from '@a-idol/shared';
import type { VoteRuleRecord } from '../../application/vote-rule-interfaces';

export function toVoteRuleDto(r: VoteRuleRecord): VoteRuleDto {
  return {
    roundId: r.roundId,
    heartWeight: r.heartWeight,
    smsWeight: r.smsWeight,
    ticketWeight: r.ticketWeight,
    dailyHeartLimit: r.dailyHeartLimit,
    updatedAt: r.updatedAt.toISOString(),
  };
}
