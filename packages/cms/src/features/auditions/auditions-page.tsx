import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type {
  AuditionListItemDto,
  AuditionStatus,
} from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { AuditionDetailModal } from './audition-detail-modal';

const QK_LIST = ['admin', 'auditions'] as const;

const STATUS_ORDER: (AuditionStatus | 'ALL')[] = [
  'ALL',
  'DRAFT',
  'ACTIVE',
  'FINISHED',
  'CANCELED',
];

export function AuditionsPage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const [filter, setFilter] = useState<AuditionStatus | 'ALL'>('ALL');
  const [creating, setCreating] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: QK_LIST,
    queryFn: () => adminApi.listAuditions(),
  });

  const items = (listQuery.data ?? []).filter(
    (a) => filter === 'ALL' || a.status === filter,
  );

  const deleteAudition = useMutation({
    mutationFn: (id: string) => adminApi.deleteAudition(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_LIST }),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">오디션</h1>
          <p className="mt-1 text-sm text-ink-600">
            T-060 / T-061 / T-067 · 전체 {listQuery.data?.length ?? 0}건
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>+ 오디션 추가</Button>
      </div>

      <div className="mb-4 flex gap-2">
        {STATUS_ORDER.map((s) => {
          const active = filter === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setFilter(s)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
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
          <CardTitle className="text-base">
            {filter === 'ALL' ? '전체' : filter} · {items.length}건
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">상태</th>
                <th className="py-2 text-left">이름</th>
                <th className="py-2 text-left">기간</th>
                <th className="py-2 text-right">참가</th>
                <th className="py-2 text-right">라운드</th>
                <th className="py-2 text-right w-48">액션</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((a) => (
                  <Row
                    key={a.id}
                    a={a}
                    isAdmin={isAdmin}
                    busy={deleteAudition.isPending}
                    onOpen={() => setDetailId(a.id)}
                    onDelete={() => {
                      if (confirm(`"${a.name}"을(를) 삭제하시겠습니까?`)) {
                        deleteAudition.mutate(a.id);
                      }
                    }}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    등록된 오디션이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {deleteAudition.error ? (
            <div className="mt-3">
              <ErrorLine error={deleteAudition.error} prefix="삭제 실패" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {creating ? (
        <CreateAuditionModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            void qc.invalidateQueries({ queryKey: QK_LIST });
            setDetailId(id);
          }}
        />
      ) : null}
      {detailId ? (
        <AuditionDetailModal
          auditionId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: QK_LIST })}
        />
      ) : null}
    </div>
  );
}

function Row({
  a,
  isAdmin,
  busy,
  onOpen,
  onDelete,
}: {
  a: AuditionListItemDto;
  isAdmin: boolean;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3">
        <StatusBadge status={a.status} />
      </td>
      <td className="py-3 font-medium text-ink-900">{a.name}</td>
      <td className="py-3 text-xs text-ink-700">
        {new Date(a.startAt).toLocaleDateString()} → {new Date(a.endAt).toLocaleDateString()}
      </td>
      <td className="py-3 text-right tabular-nums text-ink-700">{a.entries}</td>
      <td className="py-3 text-right tabular-nums text-ink-700">{a.rounds}</td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onOpen}>
            열기
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={!isAdmin || busy || a.status !== 'DRAFT'}
          >
            삭제
          </Button>
        </div>
      </td>
    </tr>
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

// --- Create modal ----------------------------------------------------

const createSchema = z
  .object({
    name: z.string().trim().min(1, '이름을 입력하세요.').max(120),
    description: z.string().trim().max(2000).optional(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
  })
  .refine((v) => new Date(v.endAt).getTime() > new Date(v.startAt).getTime(), {
    message: 'endAt은 startAt보다 뒤여야 합니다.',
    path: ['endAt'],
  });
type CreateForm = z.infer<typeof createSchema>;

function CreateAuditionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: '',
      description: '',
      startAt: defaultLocal(7),
      endAt: defaultLocal(37),
    },
  });

  const mutation = useMutation({
    mutationFn: (v: CreateForm) =>
      adminApi.createAudition({
        name: v.name,
        description: v.description || null,
        startAt: new Date(v.startAt).toISOString(),
        endAt: new Date(v.endAt).toISOString(),
      }),
    onSuccess: (res) => onCreated(res.id),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="오디션 추가"
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
            {mutation.isPending ? '생성 중…' : '생성 (DRAFT)'}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>이름</Label>
          <Input {...register('name')} />
          {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label>설명</Label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>시작</Label>
          <input
            type="datetime-local"
            {...register('startAt')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>종료</Label>
          <input
            type="datetime-local"
            {...register('endAt')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
          {errors.endAt ? <p className="text-xs text-red-600">{errors.endAt.message}</p> : null}
        </div>
        {mutation.error ? (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function defaultLocal(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
