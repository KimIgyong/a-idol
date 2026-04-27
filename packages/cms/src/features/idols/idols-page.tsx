import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AdminIdolDto, AgencyDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { IdolCreateModal } from './idol-create-modal';
import { IdolScheduleSection } from './idol-schedule-section';
import { QK } from '@/lib/query-keys';
import { invalidateAfterIdolChange } from '@/lib/query-invalidation';

const idolSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(40),
  stageName: z.string().trim().max(40).optional(),
  mbti: z.string().trim().max(4).optional(),
  bio: z.string().trim().max(4000).optional(),
  heroImageUrl: z.string().trim().max(500).optional(),
  birthdate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'YYYY-MM-DD 형식으로 입력하세요.',
    }),
  agencyId: z.string().uuid('올바른 Agency ID가 필요합니다.'),
});

type IdolForm = z.infer<typeof idolSchema>;

// Aliased for local readability. Both keys live in the central registry
// (@/lib/query-keys) — use that going forward for new queries.
const QK_IDOLS = QK.idols;
const QK_AGENCIES = QK.agencies;

export function IdolsPage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const [page, setPage] = useState(1);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editing, setEditing] = useState<AdminIdolDto | null>(null);
  const [creating, setCreating] = useState(false);

  const idols = useQuery({
    queryKey: [...QK_IDOLS, { page, includeDeleted }],
    queryFn: () => adminApi.listIdols({ page, size: 25, includeDeleted }),
  });
  const agencies = useQuery({
    queryKey: QK_AGENCIES,
    queryFn: () => adminApi.listAgencies(),
  });

  const publish = useMutation({
    mutationFn: (id: string) => adminApi.publishIdol(id),
    onSuccess: (_, id) => invalidateAfterIdolChange(qc, id),
  });
  const unpublish = useMutation({
    mutationFn: (id: string) => adminApi.unpublishIdol(id),
    onSuccess: (_, id) => invalidateAfterIdolChange(qc, id),
  });
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.deleteIdol(id),
    onSuccess: (_, id) => invalidateAfterIdolChange(qc, id),
  });

  const total = idols.data?.total ?? 0;
  const hasNext = !!idols.data?.nextCursor;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Idol 관리</h1>
          <p className="mt-1 text-sm text-ink-600">
            T-020 / T-026 · 전체 {total}명{idols.data ? ` · 현재 페이지 ${page}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-ink-600">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(e) => {
                setIncludeDeleted(e.target.checked);
                setPage(1);
              }}
            />
            삭제된 idol 포함
          </label>
          <Button onClick={() => setCreating(true)}>+ Idol 추가</Button>
        </div>
      </div>

      {idols.error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={idols.error} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Idols</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">이름</th>
                <th className="py-2 text-left">Agency</th>
                <th className="py-2 text-left">MBTI</th>
                <th className="py-2 text-right">❤</th>
                <th className="py-2 text-right">👥</th>
                <th className="py-2 text-center">상태</th>
                <th className="py-2 text-right w-72">액션</th>
              </tr>
            </thead>
            <tbody>
              {idols.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : idols.data && idols.data.items.length > 0 ? (
                idols.data.items.map((i) => (
                  <IdolRow
                    key={i.id}
                    idol={i}
                    isAdmin={isAdmin}
                    onEdit={() => setEditing(i)}
                    onPublish={() => publish.mutate(i.id)}
                    onUnpublish={() => unpublish.mutate(i.id)}
                    onDelete={() => {
                      if (confirm(`"${i.stageName ?? i.name}" 을(를) 삭제하시겠습니까?`)) {
                        remove.mutate(i.id);
                      }
                    }}
                    busy={publish.isPending || unpublish.isPending || remove.isPending}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    등록된 idol 이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="mt-4 flex items-center justify-between text-xs text-ink-600">
            <span>
              {total}명 중 {idols.data?.items.length ?? 0}명 표시
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || idols.isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!hasNext || idols.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editing && agencies.data ? (
        <IdolEditModal
          idol={editing}
          agencies={agencies.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            const editedId = editing.id;
            setEditing(null);
            invalidateAfterIdolChange(qc, editedId);
          }}
        />
      ) : null}
      {creating ? (
        <IdolCreateModal
          onClose={() => setCreating(false)}
          onCreated={() => setCreating(false)}
        />
      ) : null}
    </div>
  );
}

function IdolRow({
  idol,
  isAdmin,
  busy,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
}: {
  idol: AdminIdolDto;
  isAdmin: boolean;
  busy: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onDelete: () => void;
}) {
  const isDeleted = !!idol.deletedAt;
  const isPublished = !!idol.publishedAt && !isDeleted;

  return (
    <tr className={`border-b border-slate-100 ${isDeleted ? 'opacity-50' : ''}`}>
      <td className="py-3">
        <div className="font-medium text-ink-900">{idol.stageName ?? idol.name}</div>
        {idol.stageName && idol.stageName !== idol.name ? (
          <div className="text-xs text-ink-600">{idol.name}</div>
        ) : null}
      </td>
      <td className="py-3 text-ink-700">{idol.agencyName}</td>
      <td className="py-3 text-ink-700">{idol.mbti ?? '—'}</td>
      <td className="py-3 text-right tabular-nums text-ink-700">
        {idol.heartCount.toLocaleString()}
      </td>
      <td className="py-3 text-right tabular-nums text-ink-700">
        {idol.followCount.toLocaleString()}
      </td>
      <td className="py-3 text-center">
        {isDeleted ? (
          <span className="inline-flex rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            DELETED
          </span>
        ) : isPublished ? (
          <span className="inline-flex rounded bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
            PUBLISHED
          </span>
        ) : (
          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            DRAFT
          </span>
        )}
      </td>
      <td className="py-3 text-right">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={isDeleted}>
            편집
          </Button>
          {isPublished ? (
            <Button size="sm" variant="ghost" onClick={onUnpublish} disabled={busy}>
              비공개
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onPublish} disabled={busy || isDeleted}>
              공개
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={onDelete}
            disabled={!isAdmin || isDeleted || busy}
          >
            삭제
          </Button>
        </div>
      </td>
    </tr>
  );
}

function IdolEditModal({
  idol,
  agencies,
  onClose,
  onSaved,
}: {
  idol: AdminIdolDto;
  agencies: AgencyDto[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<IdolForm>({
    resolver: zodResolver(idolSchema),
    defaultValues: {
      name: idol.name,
      stageName: idol.stageName ?? '',
      mbti: idol.mbti ?? '',
      bio: idol.bio ?? '',
      heroImageUrl: idol.heroImageUrl ?? '',
      birthdate: idol.birthdate ?? '',
      agencyId: idol.agencyId,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: IdolForm) =>
      adminApi.updateIdol(idol.id, {
        name: v.name,
        stageName: v.stageName || null,
        mbti: v.mbti || null,
        bio: v.bio || null,
        heroImageUrl: v.heroImageUrl || null,
        birthdate: v.birthdate || null,
        agencyId: v.agencyId,
      }),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Idol 편집 · ${idol.stageName ?? idol.name}`}
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
            {mutation.isPending ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <Field label="이름" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="활동명 (stageName)" error={errors.stageName?.message}>
          <Input {...register('stageName')} />
        </Field>
        <Field label="Agency" error={errors.agencyId?.message}>
          <select
            {...register('agencyId')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink-900"
          >
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="MBTI" error={errors.mbti?.message}>
          <Input maxLength={4} {...register('mbti')} placeholder="INFJ" />
        </Field>
        <Field label="생일 (YYYY-MM-DD)" error={errors.birthdate?.message}>
          <Input placeholder="2002-05-14" {...register('birthdate')} />
        </Field>
        <Field label="Hero 이미지 URL" error={errors.heroImageUrl?.message}>
          <Input {...register('heroImageUrl')} placeholder="/api/uploads/…" />
        </Field>
        <div className="col-span-2">
          <Field label="소개 (bio)" error={errors.bio?.message}>
            <textarea
              {...register('bio')}
              rows={5}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            />
          </Field>
        </div>
        {mutation.error ? (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
      <div className="mt-6 border-t border-slate-200 pt-5">
        <IdolScheduleSection idolId={idol.id} />
      </div>
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
