import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuditionStatus, RoundDto, RoundStatus } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { RoundVoteRuleSection } from './round-vote-rule-section';
import { QK } from '@/lib/query-keys';
import {
  invalidateAfterAuditionChange,
  invalidateAfterRoundChange,
} from '@/lib/query-invalidation';

interface Props {
  auditionId: string;
  onClose: () => void;
  onChanged: () => void;
}

export function AuditionDetailModal({ auditionId, onClose, onChanged }: Props) {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const detail = useQuery({
    queryKey: QK.auditionDetail(auditionId),
    queryFn: () => adminApi.getAudition(auditionId),
  });

  // Audition-level transitions (activate/finish/cancel) + entry mutations
  // refresh both the list and the open detail — `invalidateAfterAuditionChange`
  // handles both fan-outs.
  const afterAudition = () => {
    invalidateAfterAuditionChange(qc, auditionId);
    onChanged();
  };
  // Round transitions bump the parent audition's updatedAt (ADR-021
  // write-through), so the detail still invalidates; the helper also
  // touches the `vote-rule` query for the specific round.
  const afterRound = (roundId?: string) => {
    invalidateAfterRoundChange(qc, auditionId, roundId);
    onChanged();
  };

  const transition = useMutation({
    mutationFn: (action: 'activate' | 'finish' | 'cancel') =>
      adminApi.transitionAudition(auditionId, action),
    onSuccess: afterAudition,
  });
  const roundTransition = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'activate' | 'close' }) =>
      adminApi.transitionRound(id, action),
    onSuccess: (_, { id }) => afterRound(id),
  });
  const deleteRound = useMutation({
    mutationFn: (id: string) => adminApi.deleteRound(id),
    onSuccess: (_, id) => afterRound(id),
  });
  const removeEntry = useMutation({
    mutationFn: (idolId: string) => adminApi.removeEntry(auditionId, idolId),
    onSuccess: afterAudition,
  });

  const [showAddRound, setShowAddRound] = useState(false);
  const [expandedRoundId, setExpandedRoundId] = useState<string | null>(null);

  const audition = detail.data;
  const status = audition?.status as AuditionStatus | undefined;
  const canEdit = status === 'DRAFT' || status === 'ACTIVE';

  return (
    <Modal
      open
      onClose={onClose}
      title={audition ? `${audition.name}` : '로딩 중…'}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {detail.isLoading || !audition ? (
        <p className="py-4 text-center text-sm text-ink-600">로딩 중…</p>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <StatusBadge status={audition.status} />
              <span className="ml-3 text-xs text-ink-600">
                {new Date(audition.startAt).toLocaleDateString()} →{' '}
                {new Date(audition.endAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex gap-2">
              {audition.status === 'DRAFT' ? (
                <Button
                  size="sm"
                  onClick={() => transition.mutate('activate')}
                  disabled={transition.isPending}
                >
                  활성화
                </Button>
              ) : null}
              {audition.status === 'ACTIVE' ? (
                <Button
                  size="sm"
                  onClick={() => transition.mutate('finish')}
                  disabled={transition.isPending}
                >
                  종료
                </Button>
              ) : null}
              {isAdmin && (audition.status === 'DRAFT' || audition.status === 'ACTIVE') ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (confirm('오디션을 취소하시겠습니까?')) transition.mutate('cancel');
                  }}
                  disabled={transition.isPending}
                >
                  취소
                </Button>
              ) : null}
            </div>
          </div>

          {audition.description ? (
            <p className="rounded-md bg-slate-50 p-3 text-sm text-ink-700">
              {audition.description}
            </p>
          ) : null}

          {transition.error ? (
            <div className="rounded-md bg-red-50 px-3 py-2">
              <ErrorLine error={transition.error} prefix="전환 실패" />
            </div>
          ) : null}

          {/* Entries */}
          <Section title={`참가 아이돌 (${audition.entries.length})`}>
            {audition.entries.length === 0 ? (
              <p className="text-xs text-ink-600">참가자가 없습니다.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {audition.entries.map((e) => (
                  <span
                    key={e.idolId}
                    className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs text-ink-800"
                  >
                    {e.stageName ?? e.idolName}
                    {audition.status === 'DRAFT' ? (
                      <button
                        type="button"
                        onClick={() => removeEntry.mutate(e.idolId)}
                        className="text-ink-600 hover:text-red-600"
                        disabled={removeEntry.isPending}
                        title="제거"
                      >
                        ×
                      </button>
                    ) : null}
                  </span>
                ))}
              </div>
            )}
            {removeEntry.error ? (
              <div className="mt-2">
                <ErrorLine error={removeEntry.error} />
              </div>
            ) : null}
          </Section>

          {/* Rounds */}
          <Section
            title={`라운드 (${audition.rounds.length})`}
            right={
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddRound(true)}
                >
                  + 라운드 추가
                </Button>
              ) : null
            }
          >
            {audition.rounds.length === 0 ? (
              <p className="text-xs text-ink-600">라운드가 없습니다.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {audition.rounds.map((r) => {
                  const expanded = expandedRoundId === r.id;
                  return (
                    <div
                      key={r.id}
                      className="rounded-md border border-slate-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono">
                            #{r.orderIndex}
                          </span>
                          <span className="font-medium text-ink-900">{r.name}</span>
                          <RoundStatusBadge status={r.status} />
                        </div>
                        <div className="flex gap-1">
                          {r.status === 'SCHEDULED' && audition.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                roundTransition.mutate({ id: r.id, action: 'activate' })
                              }
                              disabled={roundTransition.isPending}
                            >
                              시작
                            </Button>
                          ) : null}
                          {r.status === 'ACTIVE' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                roundTransition.mutate({ id: r.id, action: 'close' })
                              }
                              disabled={roundTransition.isPending}
                            >
                              종료
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedRoundId(expanded ? null : r.id)}
                          >
                            {expanded ? '접기' : '규칙'}
                          </Button>
                          {isAdmin && r.status === 'SCHEDULED' ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (confirm('라운드를 삭제하시겠습니까?')) {
                                  deleteRound.mutate(r.id);
                                }
                              }}
                              disabled={deleteRound.isPending}
                            >
                              삭제
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-ink-600">
                        {new Date(r.startAt).toLocaleString()} →{' '}
                        {new Date(r.endAt).toLocaleString()}
                        {r.maxAdvancers ? ` · 진출 ${r.maxAdvancers}명` : ''}
                      </div>
                      {expanded ? (
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <RoundVoteRuleSection round={r} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {roundTransition.error ? (
              <div className="mt-2">
                <ErrorLine error={roundTransition.error} />
              </div>
            ) : null}
          </Section>
        </div>
      )}

      {showAddRound && audition ? (
        <CreateRoundModal
          auditionId={auditionId}
          nextOrderIndex={(audition.rounds.at(-1)?.orderIndex ?? 0) + 1}
          onClose={() => setShowAddRound(false)}
          onCreated={() => {
            setShowAddRound(false);
            afterAudition();
          }}
        />
      ) : null}
    </Modal>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink-600">
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: AuditionStatus }) {
  const cls =
    status === 'DRAFT'
      ? 'bg-slate-100 text-slate-700'
      : status === 'ACTIVE'
        ? 'bg-green-100 text-green-700'
        : status === 'FINISHED'
          ? 'bg-blue-100 text-blue-700'
          : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function RoundStatusBadge({ status }: { status: RoundStatus }) {
  const cls =
    status === 'SCHEDULED'
      ? 'bg-slate-100 text-slate-700'
      : status === 'ACTIVE'
        ? 'bg-green-100 text-green-700'
        : 'bg-blue-100 text-blue-700';
  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// --- Create round sub-modal ------------------------------------------

function CreateRoundModal({
  auditionId,
  nextOrderIndex,
  onClose,
  onCreated,
}: {
  auditionId: string;
  nextOrderIndex: number;
  onClose: () => void;
  onCreated: (r: RoundDto) => void;
}) {
  const [form, setForm] = useState({
    name: '',
    orderIndex: nextOrderIndex,
    startAt: '',
    endAt: '',
    maxAdvancers: '',
  });
  const mutation = useMutation({
    mutationFn: () =>
      adminApi.createRound(auditionId, {
        name: form.name.trim(),
        orderIndex: form.orderIndex,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        maxAdvancers: form.maxAdvancers ? Number(form.maxAdvancers) : null,
      }),
    onSuccess: onCreated,
  });

  const canSubmit =
    form.name.trim().length > 0 && form.startAt && form.endAt && !mutation.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title="라운드 추가"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending ? '생성 중…' : '생성'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>이름</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>순서</Label>
          <Input
            type="number"
            min={1}
            value={form.orderIndex}
            onChange={(e) =>
              setForm((f) => ({ ...f, orderIndex: Number(e.target.value) || 1 }))
            }
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>진출자 (선택)</Label>
          <Input
            type="number"
            min={1}
            placeholder="10"
            value={form.maxAdvancers}
            onChange={(e) => setForm((f) => ({ ...f, maxAdvancers: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>시작</Label>
          <input
            type="datetime-local"
            value={form.startAt}
            onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>종료</Label>
          <input
            type="datetime-local"
            value={form.endAt}
            onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        {mutation.error ? (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
