import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { IdolScheduleType } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SCHEDULE_TYPES: IdolScheduleType[] = [
  'BROADCAST',
  'CONCERT',
  'FANMEETING',
  'STREAMING',
  'OTHER',
];

interface Props {
  idolId: string;
}

export function IdolScheduleSection({ idolId }: Props) {
  const qc = useQueryClient();
  const queryKey = ['admin', 'schedules', idolId] as const;

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => adminApi.listSchedules(idolId),
  });

  const [draft, setDraft] = useState({
    type: 'OTHER' as IdolScheduleType,
    title: '',
    location: '',
    startAt: '',
    endAt: '',
  });

  const create = useMutation({
    mutationFn: () =>
      adminApi.createSchedule(idolId, {
        type: draft.type,
        title: draft.title,
        location: draft.location || null,
        startAt: new Date(draft.startAt).toISOString(),
        endAt: draft.endAt ? new Date(draft.endAt).toISOString() : null,
      }),
    onSuccess: () => {
      setDraft({ type: 'OTHER', title: '', location: '', startAt: '', endAt: '' });
      void qc.invalidateQueries({ queryKey });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const canCreate = draft.title.trim().length > 0 && draft.startAt.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-600">
        Schedules
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2">
          <ErrorLine error={error} />
        </div>
      ) : null}

      <div className="rounded-md border border-slate-200">
        {isLoading ? (
          <div className="p-3 text-xs text-ink-600">로딩 중…</div>
        ) : data && data.length > 0 ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-ink-600">
                <th className="px-3 py-2 text-left">타입</th>
                <th className="px-3 py-2 text-left">제목</th>
                <th className="px-3 py-2 text-left">위치</th>
                <th className="px-3 py-2 text-left">시작</th>
                <th className="px-3 py-2 text-right w-20"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      {s.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium text-ink-900">{s.title}</td>
                  <td className="px-3 py-2 text-ink-700">{s.location ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-700 tabular-nums">
                    {new Date(s.startAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(s.id)}
                      disabled={remove.isPending}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-3 text-xs text-ink-600">등록된 일정이 없습니다.</div>
        )}
      </div>

      <div className="rounded-md border border-dashed border-slate-300 p-3">
        <div className="mb-2 text-xs font-medium text-ink-700">새 일정 추가</div>
        <div className="grid grid-cols-5 gap-2">
          <div>
            <Label className="text-[11px]">타입</Label>
            <select
              value={draft.type}
              onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value as IdolScheduleType }))}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
            >
              {SCHEDULE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label className="text-[11px]">제목</Label>
            <Input
              className="h-9 text-xs"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px]">위치</Label>
            <Input
              className="h-9 text-xs"
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px]">시작 (datetime-local)</Label>
            <input
              type="datetime-local"
              value={draft.startAt}
              onChange={(e) => setDraft((d) => ({ ...d, startAt: e.target.value }))}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
            />
          </div>
          <div className="col-span-2">
            <Label className="text-[11px]">종료 (옵션)</Label>
            <input
              type="datetime-local"
              value={draft.endAt}
              onChange={(e) => setDraft((d) => ({ ...d, endAt: e.target.value }))}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
            />
          </div>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => create.mutate()}
            disabled={!canCreate || create.isPending}
          >
            {create.isPending ? '추가…' : '추가'}
          </Button>
        </div>
        {create.error ? (
          <div className="mt-2">
            <ErrorLine error={create.error} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
