import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type {
  AutoMessageStatus,
  AutoMessageTemplateDto,
} from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';

const STATUSES: (AutoMessageStatus | 'ALL')[] = [
  'ALL',
  'SCHEDULED',
  'DISPATCHED',
  'CANCELED',
  'FAILED',
];

import { QK as QK_REGISTRY } from '@/lib/query-keys';
import { invalidateAfterAutoMessageChange } from '@/lib/query-invalidation';

// Filter-scoped query key — extends the base registry key so a broad
// `invalidateQueries({ queryKey: QK_REGISTRY.autoMessages })` matches every
// filter/page variant.
const QK = (f: { status?: AutoMessageStatus; page?: number } = {}) =>
  [...QK_REGISTRY.autoMessages, f] as const;

export function AutoMessagesPage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const [statusFilter, setStatusFilter] = useState<AutoMessageStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);

  const listQuery = useQuery({
    queryKey: QK({ status: statusFilter === 'ALL' ? undefined : statusFilter, page }),
    queryFn: () =>
      adminApi.listAutoMessages({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page,
        size: 25,
      }),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => adminApi.cancelAutoMessage(id),
    onSuccess: () => invalidateAfterAutoMessageChange(qc),
  });
  const dispatch = useMutation({
    mutationFn: (id: string) => adminApi.dispatchAutoMessageNow(id),
    onSuccess: () => invalidateAfterAutoMessageChange(qc),
  });

  const total = listQuery.data?.total ?? 0;
  const hasNext = !!listQuery.data?.nextCursor;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">자동 메시지</h1>
          <p className="mt-1 text-sm text-ink-600">T-027 · 전체 {total}건</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ 자동 메시지 예약</Button>
      </div>

      <div className="mb-4 flex items-center gap-2">
        {STATUSES.map((s) => {
          const active = statusFilter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition ${
                active
                  ? 'border-brand-500 bg-brand-500 text-white'
                  : 'border-slate-300 bg-white text-ink-600 hover:bg-slate-50'
              }`}
            >
              {s === 'ALL' ? '전체' : s}
            </button>
          );
        })}
      </div>

      {listQuery.error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={listQuery.error} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">예약 현황</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">상태</th>
                <th className="py-2 text-left">아이돌</th>
                <th className="py-2 text-left">제목 / 내용</th>
                <th className="py-2 text-left">예약 시각</th>
                <th className="py-2 text-right">수신자</th>
                <th className="py-2 text-right w-60">액션</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : listQuery.data && listQuery.data.items.length > 0 ? (
                listQuery.data.items.map((t) => (
                  <Row
                    key={t.id}
                    t={t}
                    isAdmin={isAdmin}
                    busy={cancel.isPending || dispatch.isPending}
                    onCancel={() => {
                      if (confirm(`"${t.title}" 을(를) 취소하시겠습니까?`)) {
                        cancel.mutate(t.id);
                      }
                    }}
                    onDispatch={() => {
                      if (confirm(`"${t.title}"을(를) 지금 발송하시겠습니까?`)) {
                        dispatch.mutate(t.id);
                      }
                    }}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    예약된 자동 메시지가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-xs text-ink-600">
            <span>
              {total}건 중 {listQuery.data?.items.length ?? 0}건 표시
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || listQuery.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || listQuery.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          </div>

          {cancel.error ? (
            <div className="mt-3">
              <ErrorLine error={cancel.error} prefix="취소 실패" />
            </div>
          ) : null}
          {dispatch.error ? (
            <div className="mt-1">
              <ErrorLine error={dispatch.error} prefix="즉시 발송 실패" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {creating ? (
        <CreateAutoMessageModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            invalidateAfterAutoMessageChange(qc);
          }}
        />
      ) : null}
    </div>
  );
}

function Row({
  t,
  isAdmin,
  busy,
  onCancel,
  onDispatch,
}: {
  t: AutoMessageTemplateDto;
  isAdmin: boolean;
  busy: boolean;
  onCancel: () => void;
  onDispatch: () => void;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3">
        <StatusBadge status={t.status} />
      </td>
      <td className="py-3 font-medium text-ink-900">{t.idolName}</td>
      <td className="py-3 max-w-md">
        <div className="font-medium text-ink-900">{t.title}</div>
        <div className="truncate text-xs text-ink-600">{t.content}</div>
        {t.failedReason ? (
          <div className="mt-0.5 text-[11px] text-red-600">⚠ {t.failedReason}</div>
        ) : null}
      </td>
      <td className="py-3 text-xs text-ink-700 tabular-nums">
        {new Date(t.scheduledAt).toLocaleString()}
        {t.dispatchedAt ? (
          <div className="mt-0.5 text-[11px] text-ink-600">
            발송 {new Date(t.dispatchedAt).toLocaleString()}
          </div>
        ) : null}
      </td>
      <td className="py-3 text-right tabular-nums text-ink-700">
        {t.recipients.toLocaleString()}
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={onDispatch}
            disabled={!isAdmin || busy || t.status === 'DISPATCHED' || t.status === 'CANCELED'}
          >
            즉시 발송
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onCancel}
            disabled={!isAdmin || busy || t.status !== 'SCHEDULED'}
          >
            취소
          </Button>
        </div>
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: AutoMessageStatus }) {
  const cls =
    status === 'SCHEDULED'
      ? 'bg-blue-100 text-blue-700'
      : status === 'DISPATCHED'
        ? 'bg-green-100 text-green-700'
        : status === 'CANCELED'
          ? 'bg-slate-100 text-slate-700'
          : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// --- create modal ----------------------------------------------------

const createSchema = z.object({
  idolId: z.string().min(1, '아이돌을 선택하세요.'),
  title: z.string().trim().min(1, '제목을 입력하세요.').max(120),
  content: z.string().trim().min(1, '내용을 입력하세요.').max(2000),
  scheduledAt: z.string().min(1, '예약 시각을 입력하세요.'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateAutoMessageModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const idols = useQuery({
    queryKey: ['admin', 'idols', { page: 1, size: 200 }],
    queryFn: () => adminApi.listIdols({ page: 1, size: 200 }),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      idolId: '',
      title: '',
      content: '',
      scheduledAt: nextRoundedHourLocal(),
    },
  });

  const mutation = useMutation({
    mutationFn: (v: CreateForm) =>
      adminApi.createAutoMessage({
        idolId: v.idolId,
        title: v.title,
        content: v.content,
        // Convert local datetime (from <input type="datetime-local">) to ISO/UTC.
        scheduledAt: new Date(v.scheduledAt).toISOString(),
      }),
    onSuccess: onCreated,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="자동 메시지 예약"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? '예약 중…' : '예약'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <Field label="아이돌" error={errors.idolId?.message}>
          <select
            {...register('idolId')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink-900"
          >
            <option value="">— 선택 —</option>
            {idols.data?.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.stageName ?? i.name} ({i.agencyName})
              </option>
            ))}
          </select>
        </Field>
        <Field label="제목" error={errors.title?.message}>
          <Input {...register('title')} placeholder="예: 오늘 컴백 안내" />
        </Field>
        <Field label="메시지 내용" error={errors.content?.message}>
          <textarea
            {...register('content')}
            rows={5}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            placeholder="팬에게 전달할 메시지"
          />
        </Field>
        <Field label="예약 시각 (로컬 시간대)" error={errors.scheduledAt?.message}>
          <input
            type="datetime-local"
            {...register('scheduledAt')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink-900"
          />
        </Field>
        {mutation.error ? (
          <div className="rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

/** Default scheduledAt: next rounded hour, formatted for <input type="datetime-local">. */
function nextRoundedHourLocal(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
