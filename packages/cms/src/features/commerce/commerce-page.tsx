import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductKind, PurchaseProductDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorLine } from '@/components/ui/error-line';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { ProductFormModal } from './product-form-modal';
import { QK } from '@/lib/query-keys';
import { invalidateAfterProductChange } from '@/lib/query-invalidation';

const KIND_LABEL: Record<ProductKind, string> = {
  CHAT_COUPON: '채팅 쿠폰',
  VOTE_TICKET: '투표권',
  PHOTOCARD_PACK: '포토카드 팩',
  FAN_CLUB_SUBSCRIPTION: '팬클럽 구독',
};

type KindFilter = 'ALL' | ProductKind;

export function CommercePage() {
  const qc = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const { data, isLoading, error } = useQuery({
    queryKey: QK.products,
    queryFn: () => adminApi.listProducts({}),
  });

  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<PurchaseProductDto | null>(null);

  const visible = useMemo(() => {
    if (!data) return [];
    if (kindFilter === 'ALL') return data;
    return data.filter((p) => p.kind === kindFilter);
  }, [data, kindFilter]);

  const toggleActive = useMutation({
    mutationFn: (args: { id: string; next: boolean }) =>
      adminApi.updateProduct(args.id, { isActive: args.next }),
    onSuccess: () => invalidateAfterProductChange(qc),
  });

  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Commerce 상품</h1>
          <p className="mt-1 text-sm text-ink-600">
            T-044 / ADR-015 · 상품 CRUD · DEV_SANDBOX 즉시 fulfillment · IAP
            어댑터는 follow-up
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!isAdmin}>
          + 상품 추가
        </Button>
      </div>

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={error} prefix="불러오기 실패" />
          </CardContent>
        </Card>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['ALL', 'CHAT_COUPON', 'VOTE_TICKET', 'PHOTOCARD_PACK', 'FAN_CLUB_SUBSCRIPTION'] as KindFilter[]).map(
          (k) => {
            const active = k === kindFilter;
            const n = k === 'ALL' ? data?.length ?? 0 : (data ?? []).filter((p) => p.kind === k).length;
            return (
              <button
                key={k}
                onClick={() => setKindFilter(k)}
                className={
                  active
                    ? 'rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-slate-50'
                }
              >
                {k === 'ALL' ? '전체' : KIND_LABEL[k]} <span className="ml-1 opacity-70">{n}</span>
              </button>
            );
          },
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">목록 ({visible.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                <th className="py-2 text-left">SKU</th>
                <th className="py-2 text-left">타입</th>
                <th className="py-2 text-left">이름</th>
                <th className="py-2 text-right">가격</th>
                <th className="py-2 text-left">Delivery</th>
                <th className="py-2 text-center">상태</th>
                <th className="py-2 text-right w-40">액션</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    로딩 중…
                  </td>
                </tr>
              ) : visible.length > 0 ? (
                visible.map((p) => (
                  <ProductRow
                    key={p.id}
                    row={p}
                    canEdit={isAdmin}
                    onEdit={() => setEditing(p)}
                    onToggleActive={() =>
                      toggleActive.mutate({ id: p.id, next: !p.isActive })
                    }
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-600">
                    상품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {toggleActive.error ? (
            <div className="mt-3">
              <ErrorLine error={toggleActive.error} prefix="상태 변경 실패" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {creating ? (
        <ProductFormModal
          mode="create"
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            invalidateAfterProductChange(qc);
          }}
        />
      ) : null}
      {editing ? (
        <ProductFormModal
          mode="edit"
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidateAfterProductChange(qc);
          }}
        />
      ) : null}
    </div>
  );
}

function ProductRow({
  row,
  canEdit,
  onEdit,
  onToggleActive,
}: {
  row: PurchaseProductDto;
  canEdit: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
}) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-3 font-mono text-xs text-ink-700">{row.sku}</td>
      <td className="py-3 text-ink-700">{KIND_LABEL[row.kind] ?? row.kind}</td>
      <td className="py-3 font-medium text-ink-900">{row.title}</td>
      <td className="py-3 text-right tabular-nums text-ink-900">
        {row.priceKrw.toLocaleString()}₩
      </td>
      <td className="py-3 max-w-xs">
        <code className="block truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-ink-700">
          {JSON.stringify(row.deliveryPayload)}
        </code>
      </td>
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
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={!canEdit}>
            편집
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleActive}
            disabled={!canEdit}
          >
            {row.isActive ? '비활성' : '활성'}
          </Button>
        </div>
      </td>
    </tr>
  );
}
