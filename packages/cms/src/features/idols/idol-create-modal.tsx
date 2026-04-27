import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

const schema = z.object({
  agencyId: z.string().min(1, 'Agency를 선택하세요.'),
  name: z.string().trim().min(1, '이름을 입력하세요.').max(40),
  stageName: z.string().trim().max(40).optional(),
  mbti: z.string().trim().max(4).optional(),
  bio: z.string().trim().max(4000).optional(),
  birthdate: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), 'YYYY-MM-DD'),
  publishImmediately: z.boolean().default(false),
});
type FormValues = z.infer<typeof schema>;

export function IdolCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const agencies = useQuery({
    queryKey: ['admin', 'agencies'],
    queryFn: () => adminApi.listAgencies(),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      agencyId: agencies.data?.[0]?.id ?? '',
      name: '',
      publishImmediately: false,
    },
  });

  const mutation = useMutation({
    mutationFn: (v: FormValues) =>
      adminApi.createIdol({
        agencyId: v.agencyId,
        name: v.name,
        stageName: v.stageName || null,
        mbti: v.mbti || null,
        bio: v.bio || null,
        birthdate: v.birthdate || null,
        publishImmediately: v.publishImmediately,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'idols'] });
      onCreated();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Idol 추가"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            onClick={handleSubmit((v) => mutation.mutate(v))}
            disabled={mutation.isPending || agencies.isLoading}
          >
            {mutation.isPending ? '생성 중…' : '생성'}
          </Button>
        </>
      }
    >
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <Field label="Agency" error={errors.agencyId?.message}>
          <select
            {...register('agencyId')}
            className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-ink-900"
          >
            {agencies.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="이름 (본명)" error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="활동명 (stageName)" error={errors.stageName?.message}>
          <Input {...register('stageName')} />
        </Field>
        <Field label="MBTI" error={errors.mbti?.message}>
          <Input maxLength={4} {...register('mbti')} placeholder="INFJ" />
        </Field>
        <Field label="생일 (YYYY-MM-DD)" error={errors.birthdate?.message}>
          <Input placeholder="2002-05-14" {...register('birthdate')} />
        </Field>
        <Field label="즉시 공개">
          <label className="flex items-center gap-2 text-sm text-ink-700 h-9">
            <input type="checkbox" {...register('publishImmediately')} />
            publishedAt = 지금
          </label>
        </Field>
        <div className="col-span-2">
          <Field label="소개 (bio)" error={errors.bio?.message}>
            <textarea
              {...register('bio')}
              rows={4}
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
