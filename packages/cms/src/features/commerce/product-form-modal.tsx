import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ProductKind, PurchaseProductDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { ErrorLine } from '@/components/ui/error-line';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';

const KINDS: ProductKind[] = [
  'CHAT_COUPON',
  'VOTE_TICKET',
  'PHOTOCARD_PACK',
  'FAN_CLUB_SUBSCRIPTION',
];

const PAYLOAD_HINT: Record<ProductKind, string> = {
  CHAT_COUPON: '{"couponAmount": 10}',
  VOTE_TICKET: '{"ticketAmount": 10}',
  PHOTOCARD_PACK: '{"setId": "UUID", "count": 5}',
  FAN_CLUB_SUBSCRIPTION: '{"idolId": "UUID", "durationDays": 30}',
};

const createSchema = z.object({
  sku: z.string().trim().min(1, 'SKU 필수').max(60),
  kind: z.enum(['CHAT_COUPON', 'VOTE_TICKET', 'PHOTOCARD_PACK', 'FAN_CLUB_SUBSCRIPTION']),
  title: z.string().trim().min(1, '이름 필수').max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  priceKrw: z.coerce.number().int().min(0, '0 이상'),
  deliveryPayloadJson: z.string().trim().min(2, '{} 이상'),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  priceKrw: z.coerce.number().int().min(0),
  deliveryPayloadJson: z.string().trim().min(2),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

type Props =
  | { mode: 'create'; initial?: undefined; onClose: () => void; onSaved: () => void }
  | { mode: 'edit'; initial: PurchaseProductDto; onClose: () => void; onSaved: () => void };

export function ProductFormModal(props: Props) {
  return props.mode === 'create' ? <CreateForm {...props} /> : <EditForm {...props} />;
}

function parsePayload(raw: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
    return v as Record<string, unknown>;
  } catch {
    return null;
  }
}

function CreateForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      sku: '',
      kind: 'CHAT_COUPON',
      title: '',
      description: '',
      priceKrw: 1000,
      deliveryPayloadJson: PAYLOAD_HINT.CHAT_COUPON,
    },
  });

  const kind = watch('kind');
  const [lastKind, setLastKind] = useState<ProductKind>('CHAT_COUPON');
  useEffect(() => {
    // When the user changes kind, pre-fill the delivery-payload hint for that
    // kind — only if they haven't already customized it past the hint.
    if (kind !== lastKind) {
      setValue('deliveryPayloadJson', PAYLOAD_HINT[kind]);
      setLastKind(kind);
    }
  }, [kind, lastKind, setValue]);

  const [jsonError, setJsonError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (v: CreateValues) => {
      const payload = parsePayload(v.deliveryPayloadJson);
      if (!payload) {
        setJsonError('유효한 JSON 객체를 입력하세요.');
        throw new Error('invalid json');
      }
      setJsonError(null);
      return adminApi.createProduct({
        sku: v.sku,
        kind: v.kind,
        title: v.title,
        description: v.description || null,
        priceKrw: v.priceKrw,
        deliveryPayload: payload,
      });
    },
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="상품 추가"
      size="lg"
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
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sku">SKU</Label>
          <Input id="sku" placeholder="chat-coupon-30" {...register('sku')} />
          {errors.sku ? <p className="text-xs text-red-600">{errors.sku.message}</p> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kind">타입</Label>
          <select
            id="kind"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm"
            {...register('kind')}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="title">이름</Label>
          <Input id="title" placeholder="채팅 쿠폰 30매" {...register('title')} />
          {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="description">설명</Label>
          <Input id="description" placeholder="(선택)" {...register('description')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceKrw">가격 (KRW)</Label>
          <Input id="priceKrw" type="number" min={0} {...register('priceKrw')} />
          {errors.priceKrw ? (
            <p className="text-xs text-red-600">{errors.priceKrw.message}</p>
          ) : null}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="dp">Delivery Payload (JSON)</Label>
          <textarea
            id="dp"
            rows={3}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
            {...register('deliveryPayloadJson')}
          />
          <p className="text-[11px] text-ink-600">
            힌트 ({kind}): <code>{PAYLOAD_HINT[kind]}</code>
          </p>
          {errors.deliveryPayloadJson ? (
            <p className="text-xs text-red-600">{errors.deliveryPayloadJson.message}</p>
          ) : null}
          {jsonError ? <p className="text-xs text-red-600">{jsonError}</p> : null}
        </div>
        {mutation.error && !jsonError ? (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function EditForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: PurchaseProductDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      title: initial.title,
      description: initial.description ?? '',
      priceKrw: initial.priceKrw,
      deliveryPayloadJson: JSON.stringify(initial.deliveryPayload, null, 2),
      isActive: initial.isActive,
    },
  });

  const [jsonError, setJsonError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (v: EditValues) => {
      const payload = parsePayload(v.deliveryPayloadJson);
      if (!payload) {
        setJsonError('유효한 JSON 객체를 입력하세요.');
        throw new Error('invalid json');
      }
      setJsonError(null);
      return adminApi.updateProduct(initial.id, {
        title: v.title,
        description: v.description || null,
        priceKrw: v.priceKrw,
        deliveryPayload: payload,
        isActive: v.isActive,
      });
    },
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`상품 편집 · ${initial.sku}`}
      size="lg"
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
      <form className="grid grid-cols-2 gap-4" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="col-span-2 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-ink-600">
          <span>
            SKU <span className="font-mono text-ink-900">{initial.sku}</span> · 타입{' '}
            <span className="font-semibold text-ink-900">{initial.kind}</span>
          </span>
          <span className="text-ink-500">(SKU / kind은 변경 불가)</span>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="title">이름</Label>
          <Input id="title" {...register('title')} />
          {errors.title ? <p className="text-xs text-red-600">{errors.title.message}</p> : null}
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="description">설명</Label>
          <Input id="description" {...register('description')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceKrw">가격 (KRW)</Label>
          <Input id="priceKrw" type="number" min={0} {...register('priceKrw')} />
          {errors.priceKrw ? (
            <p className="text-xs text-red-600">{errors.priceKrw.message}</p>
          ) : null}
        </div>
        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" {...register('isActive')} />
            활성화
          </label>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <Label htmlFor="dp">Delivery Payload (JSON)</Label>
          <textarea
            id="dp"
            rows={5}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-xs"
            {...register('deliveryPayloadJson')}
          />
          {jsonError ? <p className="text-xs text-red-600">{jsonError}</p> : null}
        </div>
        {mutation.error && !jsonError ? (
          <div className="col-span-2 rounded-md bg-red-50 px-3 py-2">
            <ErrorLine error={mutation.error} />
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
