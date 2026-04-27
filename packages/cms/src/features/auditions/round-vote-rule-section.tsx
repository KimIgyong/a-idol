import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoundDto, VoteRuleDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QK } from '@/lib/query-keys';
import { invalidateAfterRoundChange } from '@/lib/query-invalidation';

interface Props {
  round: RoundDto;
}

export function RoundVoteRuleSection({ round }: Props) {
  const qc = useQueryClient();

  const ruleQuery = useQuery({
    queryKey: QK.voteRule(round.id),
    queryFn: async () => {
      try {
        return await adminApi.getVoteRule(round.id);
      } catch (err) {
        // 404 → no rule yet; surface as null (not error).
        if ((err as ApiError).status === 404) return null;
        throw err;
      }
    },
  });

  const [form, setForm] = useState({
    heartWeight: '1',
    smsWeight: '0',
    ticketWeight: '10',
    dailyHeartLimit: '1',
  });

  // Sync form with server value whenever it (re)loads.
  useEffect(() => {
    if (ruleQuery.data) {
      setForm({
        heartWeight: String(ruleQuery.data.heartWeight),
        smsWeight: String(ruleQuery.data.smsWeight),
        ticketWeight: String(ruleQuery.data.ticketWeight),
        dailyHeartLimit: String(ruleQuery.data.dailyHeartLimit),
      });
    }
  }, [ruleQuery.data]);

  const upsert = useMutation({
    mutationFn: () =>
      adminApi.upsertVoteRule(round.id, {
        heartWeight: Number(form.heartWeight),
        smsWeight: Number(form.smsWeight),
        ticketWeight: Number(form.ticketWeight),
        dailyHeartLimit: Number(form.dailyHeartLimit),
      }),
    // Vote-rule upsert affects the parent audition's detail indirectly
    // (rule shown inside round view) — fan out through the shared helper.
    onSuccess: () => invalidateAfterRoundChange(qc, round.auditionId, round.id),
  });

  const isEditable = round.status === 'SCHEDULED';
  const savedRule: VoteRuleDto | null = ruleQuery.data ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-600">
        투표 규칙 {savedRule ? null : '(미설정)'}
        {!isEditable ? (
          <span className="ml-2 text-[10px] font-normal text-ink-600">
            ({round.status} — 규칙은 SCHEDULED 상태에서만 수정 가능)
          </span>
        ) : null}
      </div>

      {ruleQuery.isLoading ? (
        <p className="text-xs text-ink-600">로딩 중…</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <WeightField
            label="Heart"
            value={form.heartWeight}
            onChange={(v) => setForm((f) => ({ ...f, heartWeight: v }))}
            disabled={!isEditable}
          />
          <WeightField
            label="SMS"
            value={form.smsWeight}
            onChange={(v) => setForm((f) => ({ ...f, smsWeight: v }))}
            disabled={!isEditable}
          />
          <WeightField
            label="Ticket"
            value={form.ticketWeight}
            onChange={(v) => setForm((f) => ({ ...f, ticketWeight: v }))}
            disabled={!isEditable}
          />
          <WeightField
            label="Daily ❤ limit"
            value={form.dailyHeartLimit}
            onChange={(v) => setForm((f) => ({ ...f, dailyHeartLimit: v }))}
            disabled={!isEditable}
            min={1}
          />
        </div>
      )}

      {isEditable ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => upsert.mutate()}
            disabled={upsert.isPending || ruleQuery.isLoading}
          >
            {upsert.isPending ? '저장 중…' : savedRule ? '저장' : '규칙 생성'}
          </Button>
          {savedRule ? (
            <span className="text-[11px] text-ink-600">
              최근 저장 {new Date(savedRule.updatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}

      {upsert.error ? (
        <div className="rounded-md bg-red-50 px-3 py-2">
          <ErrorLine error={upsert.error} />
        </div>
      ) : null}
    </div>
  );
}

function WeightField({
  label,
  value,
  onChange,
  disabled,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px]">{label}</Label>
      <Input
        type="number"
        min={min}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="h-8 text-sm"
      />
    </div>
  );
}
