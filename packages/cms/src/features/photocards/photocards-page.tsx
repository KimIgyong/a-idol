import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PhotocardSetListItemDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { PhotocardSetDetailModal } from './photocard-set-detail-modal';
import { QK } from '@/lib/query-keys';
import { invalidateAfterPhotocardSetChange } from '@/lib/query-invalidation';

const createSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(120),
  description: z.string().trim().max(500).optional(),
  idolId: z
    .string()
    .trim()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      '유효한 UUID 필요',
    )
    .optional()
    .or(z.literal('').transform(() => undefined)),
});
type CreateValues = z.infer<typeof createSchema>;

export function PhotocardsPage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const { data, isLoading, error } = useQuery({
    queryKey: QK.photocardSets,
    queryFn: () => adminApi.listPhotocardSets(),
  });

  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">포토카드 세트</h1>
          <p className="mt-1 text-sm text-ink-600">
            T-045 · 세트/템플릿 CRUD · 확률은 서버가 계산 (ADR-016)
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!isAdmin}>
          + 세트 추가
        </Button>
      </div>

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={error} prefix="불러오기 실패" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">전체 ({data?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">이름</th>
                <th className="py-2 text-left">설명</th>
                <th className="py-2 text-left">아이돌</th>
                <th className="py-2 text-right">템플릿</th>
                <th className="py-2 text-center">상태</th>
                <th className="py-2 text-right w-32">액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : data && data.length > 0 ? (
                data.map((s) => <SetRow key={s.id} row={s} onOpen={() => setOpeningId(s.id)} />)
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-600">
                    등록된 세트가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {creating ? (
        <CreatePhotocardSetModal
          onClose={() => setCreating(false)}
          onSaved={(newId) => {
            setCreating(false);
            invalidateAfterPhotocardSetChange(qc, newId);
            setOpeningId(newId);
          }}
        />
      ) : null}
      {openingId ? (
        <PhotocardSetDetailModal
          setId={openingId}
          onClose={() => setOpeningId(null)}
          onMutated={() => invalidateAfterPhotocardSetChange(qc, openingId)}
        />
      ) : null}
    </div>
  );
}

function SetRow({
  row,
  onOpen,
}: {
  row: PhotocardSetListItemDto;
  onOpen: () => void;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3 font-medium text-ink-900">{row.name}</td>
      <td className="py-3 text-ink-700 max-w-md truncate">
        {row.description ?? <span className="text-ink-600">—</span>}
      </td>
      <td className="py-3 text-ink-700">
        {row.idolName ?? <span className="text-ink-600">—</span>}
      </td>
      <td className="py-3 text-right tabular-nums text-ink-700">{row.templateCount}</td>
      <td className="py-3 text-center">
        <span
          className={
            row.isActive
              ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
              : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600'
          }
        >
          {row.isActive ? 'active' : 'inactive'}
        </span>
      </td>
      <td className="py-3 text-right">
        <Button size="sm" variant="outline" onClick={onOpen}>
          열기
        </Button>
      </td>
    </tr>
  );
}

function CreatePhotocardSetModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (newId: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', description: '', idolId: '' },
  });

  const mutation = useMutation({
    mutationFn: (v: CreateValues) =>
      adminApi.createPhotocardSet({
        name: v.name,
        description: v.description || null,
        idolId: v.idolId || null,
      }),
    onSuccess: (set) => onSaved(set.id),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="포토카드 세트 추가"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            disabled={mutation.isPending || isSubmitting}
          >
            {mutation.isPending ? '저장 중…' : '저장'}
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">세트 이름</Label>
          <Input id="name" placeholder="HYUN 2nd Photocard Set" {...register('name')} />
          {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">설명</Label>
          <Input id="description" placeholder="(선택)" {...register('description')} />
          {errors.description ? (
            <p className="text-xs text-red-600">{errors.description.message}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="idolId">연결할 아이돌 ID (선택)</Label>
          <Input
            id="idolId"
            placeholder="00000000-0000-0000-0000-000000000000"
            {...register('idolId')}
          />
          {errors.idolId ? (
            <p className="text-xs text-red-600">{errors.idolId.message}</p>
          ) : null}
          <p className="text-xs text-ink-600">
            생성 후 세트 상세에서 템플릿을 추가하세요.
          </p>
        </div>
        {mutation.error ? (
          <div className="rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
