import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  CreateDesignAssetDto,
  DesignAssetDto,
  DesignAssetPlatform,
  DesignAssetStatus,
  DesignAssetType,
} from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorLine } from '@/components/ui/error-line';

const QK = ['admin', 'design-assets'] as const;

const TYPE_LABEL: Record<DesignAssetType, string> = {
  APP_ICON: '앱 아이콘',
  SCREENSHOT: '스토어 스크린샷',
  FEATURE_GRAPHIC: 'Play feature graphic',
  SPLASH: '앱 splash',
  PREVIEW_VIDEO: 'App preview video',
  PERSONA_IMAGE: '아이돌 페르소나',
  PHOTOCARD_ART: '포토카드 아트',
  OTHER: '기타',
};

const PLATFORM_LABEL: Record<DesignAssetPlatform, string> = {
  IOS: 'iOS',
  ANDROID: 'Android',
  WEB: 'Web',
  ALL: '전 플랫폼',
};

const STATUS_LABEL: Record<DesignAssetStatus, string> = {
  PLACEHOLDER: '플레이스홀더',
  DRAFT: '시안',
  APPROVED: 'PO 승인',
  LEGAL_REVIEWED: '법무 통과',
  SHIPPED: '배포 완료',
};

const STATUS_BADGE: Record<DesignAssetStatus, string> = {
  PLACEHOLDER: 'bg-slate-100 text-ink-700',
  DRAFT: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-blue-50 text-blue-700',
  LEGAL_REVIEWED: 'bg-purple-50 text-purple-700',
  SHIPPED: 'bg-green-50 text-green-700',
};

/**
 * T-085 — App Store / Play 디자인 자산 관리 페이지.
 *
 *  - admin/operator 모두 read 가능 (디자이너 협업)
 *  - 작성/수정/삭제는 admin only (backend RolesGuard)
 *  - 자산 자체는 외부 storage(S3/CDN/Drive) URL 만 보관
 */
export function DesignAssetsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: () => adminApi.listDesignAssets(),
  });

  const grouped = (data ?? []).reduce<Record<DesignAssetType, DesignAssetDto[]>>(
    (acc, a) => {
      (acc[a.type] ||= []).push(a);
      return acc;
    },
    {} as Record<DesignAssetType, DesignAssetDto[]>,
  );

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-900">디자인 자산 관리</h1>
        <p className="mt-1 text-sm text-ink-600">
          App Store / Play 제출용 자산 (T-085). 디자이너 협업 + PO 승인 + 법무
          검수 상태 트래킹. 자산 파일은 외부 storage URL만 저장.
        </p>
      </div>

      <CreateAssetPanel onCreated={() => qc.invalidateQueries({ queryKey: QK })} />

      {error ? (
        <Card className="mb-4 border-red-200 bg-red-50/50">
          <CardContent className="p-4">
            <ErrorLine error={error} prefix="불러오기 실패" />
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card><CardContent className="p-8 text-center text-ink-600">로딩 중…</CardContent></Card>
      ) : !data || data.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-ink-600">등록된 자산이 없습니다.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, items]) => (
          <Card key={type} className="mb-4">
            <CardHeader>
              <CardTitle className="text-base">
                {TYPE_LABEL[type as DesignAssetType]} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-ink-600">
                    <th className="py-2 text-left">이름</th>
                    <th className="py-2 text-left">플랫폼</th>
                    <th className="py-2 text-left">상태</th>
                    <th className="py-2 text-left">사양</th>
                    <th className="py-2 text-left">파일</th>
                    <th className="py-2 text-right">정렬</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((a) => (
                    <AssetRow
                      key={a.id}
                      asset={a}
                      onChanged={() => qc.invalidateQueries({ queryKey: QK })}
                    />
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function AssetRow({
  asset,
  onChanged,
}: {
  asset: DesignAssetDto;
  onChanged: () => void;
}) {
  const updateMutation = useMutation({
    mutationFn: (status: DesignAssetStatus) =>
      adminApi.updateDesignAsset(asset.id, { status }),
    onSuccess: onChanged,
  });
  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteDesignAsset(asset.id),
    onSuccess: onChanged,
  });

  const onStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateMutation.mutate(e.target.value as DesignAssetStatus);
  };

  const onDelete = () => {
    if (confirm(`"${asset.name}" 자산을 삭제할까요?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <tr className="border-b border-slate-100">
      <td className="py-3 font-medium text-ink-900">
        {asset.name}
        {asset.caption ? (
          <div className="text-xs text-ink-600 mt-0.5">"{asset.caption}"</div>
        ) : null}
      </td>
      <td className="py-3 text-ink-700">{PLATFORM_LABEL[asset.platform]}</td>
      <td className="py-3">
        <select
          value={asset.status}
          onChange={onStatusChange}
          disabled={updateMutation.isPending}
          className={`rounded-md border-0 px-2 py-1 text-xs font-semibold ${STATUS_BADGE[asset.status]}`}
        >
          {(Object.keys(STATUS_LABEL) as DesignAssetStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
      </td>
      <td className="py-3 text-xs text-ink-600">{asset.spec ?? '—'}</td>
      <td className="py-3">
        {asset.fileUrl ? (
          <a
            href={asset.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-700 underline"
          >
            열기 ↗
          </a>
        ) : (
          <span className="text-xs text-ink-500">미첨부</span>
        )}
      </td>
      <td className="py-3 text-right">
        <span className="mr-3 text-xs text-ink-600">#{asset.orderIndex}</span>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleteMutation.isPending}
          className="text-xs text-red-600 hover:underline disabled:opacity-40"
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

function CreateAssetPanel({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateDesignAssetDto>({
    name: '',
    type: 'SCREENSHOT',
    platform: 'ALL',
    status: 'PLACEHOLDER',
    fileUrl: '',
    spec: '',
    orderIndex: 0,
    caption: '',
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: (input: CreateDesignAssetDto) => adminApi.createDesignAsset(input),
    onSuccess: () => {
      onCreated();
      setOpen(false);
      setForm({
        name: '', type: 'SCREENSHOT', platform: 'ALL', status: 'PLACEHOLDER',
        fileUrl: '', spec: '', orderIndex: 0, caption: '', notes: '',
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    // 빈 string → null
    const sanitized: CreateDesignAssetDto = {
      ...form,
      fileUrl: form.fileUrl?.trim() ? form.fileUrl : null,
      spec: form.spec?.trim() ? form.spec : null,
      caption: form.caption?.trim() ? form.caption : null,
      notes: form.notes?.trim() ? form.notes : null,
    };
    mutation.mutate(sanitized);
  };

  const errMsg = mutation.error instanceof ApiError ? mutation.error.message : null;

  if (!open) {
    return (
      <div className="mb-6">
        <Button onClick={() => setOpen(true)}>+ 새 자산 추가</Button>
      </div>
    );
  }

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/30">
      <CardHeader>
        <CardTitle className="text-base">새 디자인 자산 추가</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="da-name">이름 *</Label>
            <Input
              id="da-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 홈 피드 스크린샷 #1"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-type">타입</Label>
            <select
              id="da-type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as DesignAssetType })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(TYPE_LABEL) as DesignAssetType[]).map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-platform">플랫폼</Label>
            <select
              id="da-platform"
              value={form.platform ?? 'ALL'}
              onChange={(e) => setForm({ ...form, platform: e.target.value as DesignAssetPlatform })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {(Object.keys(PLATFORM_LABEL) as DesignAssetPlatform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="da-url">파일 URL</Label>
            <Input
              id="da-url"
              type="url"
              value={form.fileUrl ?? ''}
              onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
              placeholder="https://drive.google.com/... or https://s3..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-spec">사양</Label>
            <Input
              id="da-spec"
              value={form.spec ?? ''}
              onChange={(e) => setForm({ ...form, spec: e.target.value })}
              placeholder="1290x2796 PNG"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="da-order">정렬</Label>
            <Input
              id="da-order"
              type="number"
              min={0}
              value={form.orderIndex ?? 0}
              onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })}
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="da-caption">카피 (스크린샷용)</Label>
            <Input
              id="da-caption"
              value={form.caption ?? ''}
              onChange={(e) => setForm({ ...form, caption: e.target.value })}
              placeholder="최애 아이돌을 만나세요"
            />
          </div>

          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="da-notes">비고</Label>
            <textarea
              id="da-notes"
              rows={2}
              value={form.notes ?? ''}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="디자이너 코멘트 / PO 결정 / 법무 메모"
            />
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <Button type="submit" disabled={mutation.isPending || !form.name.trim()}>
              {mutation.isPending ? '저장 중…' : '추가'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            {errMsg ? <span className="ml-3 text-sm text-red-700">⚠ {errMsg}</span> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
