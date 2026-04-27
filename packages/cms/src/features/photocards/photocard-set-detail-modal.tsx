import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PhotocardRarity, PhotocardTemplateDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { QK } from '@/lib/query-keys';
import { invalidateAfterPhotocardSetChange } from '@/lib/query-invalidation';

const RARITIES: PhotocardRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const templateSchema = z.object({
  name: z.string().trim().min(1, '이름 필수').max(80),
  rarity: z.enum(['COMMON', 'RARE', 'EPIC', 'LEGENDARY']),
  dropWeight: z.coerce.number().int().min(1, '1 이상').max(1000),
  imageUrl: z.string().trim().optional(),
});
type TemplateValues = z.infer<typeof templateSchema>;

export function PhotocardSetDetailModal({
  setId,
  onClose,
  onMutated,
}: {
  setId: string;
  onClose: () => void;
  onMutated: () => void;
}) {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const { data: set, isLoading, error } = useQuery({
    queryKey: QK.photocardSetDetail(setId),
    queryFn: () => adminApi.getPhotocardSet(setId),
  });

  const toggleActive = useMutation({
    mutationFn: (next: boolean) =>
      adminApi.updatePhotocardSet(setId, { isActive: next }),
    onSuccess: () => {
      invalidateAfterPhotocardSetChange(qc, setId);
      onMutated();
    },
  });

  const totalPercent =
    set?.templates
      .filter((t) => t.isActive)
      .reduce((acc, t) => acc + t.dropPercent, 0) ?? 0;

  return (
    <Modal
      open
      onClose={onClose}
      title={set ? set.name : '포토카드 세트'}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      }
    >
      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2">
          <ErrorLine error={error} />
        </div>
      ) : null}

      {isLoading || !set ? (
        <p className="py-6 text-center text-sm text-ink-600">로딩 중…</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-3 rounded-md border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm">
            <MetaRow k="아이돌" v={set.idolName ?? '—'} />
            <MetaRow
              k="활성 템플릿"
              v={`${set.templates.filter((t) => t.isActive).length} / ${set.templateCount}`}
            />
            <MetaRow k="설명" v={set.description ?? '—'} />
            <div className="flex items-center justify-between">
              <span className="text-ink-600">활성 여부</span>
              <div className="flex items-center gap-2">
                <span
                  className={
                    set.isActive
                      ? 'inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700'
                      : 'inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600'
                  }
                >
                  {set.isActive ? 'active' : 'inactive'}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!isAdmin || toggleActive.isPending}
                  onClick={() => toggleActive.mutate(!set.isActive)}
                >
                  {set.isActive ? '비활성화' : '활성화'}
                </Button>
              </div>
            </div>
          </div>

          {/* Templates */}
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-ink-900">템플릿 · 확률 공개</h3>
              <span className="text-[11px] text-ink-600">
                active 합계 <span className="tabular-nums">{totalPercent.toFixed(2)}</span>%
                (정확히 100.00이 아니면 반올림 드리프트)
              </span>
            </div>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-ink-600">
                    <th className="px-3 py-2 text-left">이름</th>
                    <th className="px-3 py-2 text-left">등급</th>
                    <th className="px-3 py-2 text-right">가중치</th>
                    <th className="px-3 py-2 text-right">확률</th>
                    <th className="px-3 py-2 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {set.templates.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-ink-600">
                        템플릿이 없습니다. 아래에서 추가하세요.
                      </td>
                    </tr>
                  ) : (
                    [...set.templates]
                      .sort((a, b) => b.dropWeight - a.dropWeight)
                      .map((t) => <TemplateRow key={t.id} row={t} />)
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add template */}
          {isAdmin ? (
            <AddTemplateForm
              setId={setId}
              onAdded={() => {
                invalidateAfterPhotocardSetChange(qc, setId);
                onMutated();
              }}
            />
          ) : (
            <p className="text-xs text-ink-600">템플릿 추가는 admin 권한이 필요합니다.</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-600">{k}</span>
      <span className="text-ink-900 max-w-[16rem] truncate text-right">{v}</span>
    </div>
  );
}

function TemplateRow({ row }: { row: PhotocardTemplateDto }) {
  const rarityColor = {
    LEGENDARY: 'text-amber-600',
    EPIC: 'text-purple-600',
    RARE: 'text-sky-600',
    COMMON: 'text-ink-700',
  }[row.rarity];
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-3 py-2 text-ink-900">{row.name}</td>
      <td className={`px-3 py-2 font-semibold ${rarityColor}`}>{row.rarity}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-700">{row.dropWeight}</td>
      <td className="px-3 py-2 text-right tabular-nums text-ink-900">
        {row.dropPercent.toFixed(2)}%
      </td>
      <td className="px-3 py-2 text-center">
        {row.isActive ? (
          <span className="text-[11px] text-emerald-700">active</span>
        ) : (
          <span className="text-[11px] text-slate-500">inactive</span>
        )}
      </td>
    </tr>
  );
}

function AddTemplateForm({
  setId,
  onAdded,
}: {
  setId: string;
  onAdded: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TemplateValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: '', rarity: 'COMMON', dropWeight: 10, imageUrl: '' },
  });

  const mutation = useMutation({
    mutationFn: (v: TemplateValues) =>
      adminApi.addPhotocardTemplate(setId, {
        name: v.name,
        rarity: v.rarity,
        dropWeight: v.dropWeight,
        imageUrl: v.imageUrl || null,
      }),
    onSuccess: () => {
      reset({ name: '', rarity: 'COMMON', dropWeight: 10, imageUrl: '' });
      onAdded();
    },
  });

  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/50 p-4">
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        className="flex w-full items-center justify-between text-sm font-semibold text-ink-900"
      >
        <span>+ 템플릿 추가</span>
        <span className="text-xs text-ink-600">{panelOpen ? '▾' : '▸'}</span>
      </button>
      {panelOpen ? (
        <form
          className="mt-4 grid grid-cols-2 gap-3"
          onSubmit={(e) => e.preventDefault()}
          noValidate
        >
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="t-name">이름</Label>
            <Input id="t-name" {...register('name')} />
            {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-rarity">등급</Label>
            <select
              id="t-rarity"
              className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...register('rarity')}
            >
              {RARITIES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="t-weight">가중치</Label>
            <Input id="t-weight" type="number" min={1} {...register('dropWeight')} />
            {errors.dropWeight ? (
              <p className="text-xs text-red-600">{errors.dropWeight.message}</p>
            ) : null}
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <Label htmlFor="t-url">이미지 URL (선택)</Label>
            <Input id="t-url" placeholder="https://…" {...register('imageUrl')} />
          </div>
          {mutation.error ? (
            <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
              <ErrorLine error={mutation.error} />
            </div>
          ) : null}
          <div className="col-span-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit((v) => mutation.mutate(v))}
              disabled={mutation.isPending || isSubmitting}
            >
              {mutation.isPending ? '추가 중…' : '템플릿 추가'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
