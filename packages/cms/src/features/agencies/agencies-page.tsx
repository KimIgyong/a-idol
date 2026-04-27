import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AgencyDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { QK } from '@/lib/query-keys';
import { invalidateAfterAgencyChange } from '@/lib/query-invalidation';

const schema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(80),
  description: z.string().trim().max(500).optional(),
});
type FormValues = z.infer<typeof schema>;

export function AgenciesPage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const { data, isLoading, error } = useQuery({
    queryKey: QK.agencies,
    queryFn: () => adminApi.listAgencies(),
  });

  const [editing, setEditing] = useState<AgencyDto | null>(null);
  const [creating, setCreating] = useState(false);

  const deleteAgency = useMutation({
    mutationFn: (id: string) => adminApi.deleteAgency(id),
    // Agencies drive the idol roster — a delete must refresh the idol list
    // (rows carry `agencyName`) as well as the agency list itself.
    onSuccess: () => invalidateAfterAgencyChange(qc),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Agency 관리</h1>
          <p className="mt-1 text-sm text-ink-600">소속사 CRUD · T-020 / T-026</p>
        </div>
        <Button onClick={() => setCreating(true)}>+ Agency 추가</Button>
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
                <th className="py-2 text-right">아이돌</th>
                <th className="py-2 text-right">업데이트</th>
                <th className="py-2 text-right w-44">액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : data && data.length > 0 ? (
                data.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100">
                    <td className="py-3 font-medium text-ink-900">{a.name}</td>
                    <td className="py-3 text-ink-700 max-w-md truncate">
                      {a.description ?? <span className="text-ink-600">—</span>}
                    </td>
                    <td className="py-3 text-right tabular-nums text-ink-700">
                      {a.idolCount}
                    </td>
                    <td className="py-3 text-right text-xs text-ink-600">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                          편집
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!isAdmin || a.idolCount > 0 || deleteAgency.isPending}
                          onClick={() => {
                            if (confirm(`"${a.name}"을(를) 삭제하시겠습니까?`)) {
                              deleteAgency.mutate(a.id);
                            }
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-ink-600">
                    등록된 Agency가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {deleteAgency.error ? (
            <div className="mt-3">
              <ErrorLine error={deleteAgency.error} prefix="삭제 실패" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {creating ? (
        <AgencyFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidateAfterAgencyChange(qc);
          }}
        />
      ) : null}
      {editing ? (
        <AgencyFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidateAfterAgencyChange(qc);
          }}
        />
      ) : null}
    </div>
  );
}

function AgencyFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'create' | 'edit';
  initial?: AgencyDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      mode === 'create'
        ? adminApi.createAgency({ name: values.name, description: values.description ?? null })
        : adminApi.updateAgency(initial!.id, {
            name: values.name,
            description: values.description ?? null,
          }),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? 'Agency 추가' : `Agency 편집 · ${initial?.name}`}
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
          <Label htmlFor="name">이름</Label>
          <Input id="name" {...register('name')} />
          {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">설명</Label>
          <Input id="description" placeholder="(선택)" {...register('description')} />
          {errors.description ? (
            <p className="text-xs text-red-600">{errors.description.message}</p>
          ) : null}
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
