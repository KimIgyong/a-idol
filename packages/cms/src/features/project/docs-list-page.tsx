import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import type { ProjectDocCategory, ProjectDocStatus } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';

const CATEGORY_LABEL: Record<ProjectDocCategory, string> = {
  ADR: 'ADR',
  DESIGN: '설계',
  IMPLEMENTATION: '구현',
  DELIVERABLE: '산출물',
  REPORT: '리포트',
  OPS: '운영',
  OTHER: '기타',
};

const ALL_CATEGORIES: ProjectDocCategory[] = [
  'ADR',
  'DESIGN',
  'IMPLEMENTATION',
  'REPORT',
  'OPS',
  'OTHER',
];

const STATUS_BADGE: Record<ProjectDocStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  REVIEW: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

export function DocsListPage() {
  const [params, setParams] = useSearchParams();
  const category = (params.get('category') as ProjectDocCategory | null) || undefined;
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');
  const queryClient = useQueryClient();
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const docsQ = useQuery({
    queryKey: ['admin', 'project-docs', { category: category ?? null }],
    queryFn: () => adminApi.listProjectDocs({ category }),
  });

  const syncM = useMutation({
    mutationFn: () => adminApi.syncProjectDocsFromRepo(),
    onSuccess: (r) => {
      setSyncMessage(
        `동기화 완료 — 신규 ${r.created} · 갱신 ${r.updated} · 변동없음 ${r.unchanged} · 보관 ${r.archived} (${r.durationMs}ms)`,
      );
      void queryClient.invalidateQueries({ queryKey: ['admin', 'project-docs'] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      setSyncMessage(`동기화 실패 — ${msg}`);
    },
  });

  const docs = (docsQ.data ?? []).filter((d) => d.category !== 'DELIVERABLE');

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">프로젝트 문서</h1>
          <p className="text-sm text-slate-500">ADR · 설계 · 구현 · 리포트 등 마크다운 산출물</p>
        </div>
        {isAdmin ? (
          <div className="flex flex-col items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncM.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    '리포지토리(docs/**.md)에서 문서를 다시 가져옵니다. 운영 DB가 갱신됩니다. 계속할까요?',
                  )
                ) {
                  return;
                }
                setSyncMessage(null);
                syncM.mutate();
              }}
            >
              <RefreshCw
                className={`h-4 w-4 ${syncM.isPending ? 'animate-spin' : ''}`}
              />
              리포지토리에서 다시 가져오기
            </Button>
            {syncMessage ? (
              <span className="text-xs text-slate-600">{syncMessage}</span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setParams({})}
          className={
            !category
              ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white'
              : 'rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50'
          }
        >
          전체 ({docsQ.data?.filter((d) => d.category !== 'DELIVERABLE').length ?? 0})
        </button>
        {ALL_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setParams({ category: cat })}
            className={
              category === cat
                ? 'rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white'
                : 'rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50'
            }
          >
            {CATEGORY_LABEL[cat]}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {category ? `${CATEGORY_LABEL[category]} (${docs.length})` : `전체 (${docs.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {docsQ.isLoading ? (
            <p className="px-4 py-3 text-sm text-slate-500">불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">등록된 문서가 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">분류</th>
                  <th className="px-4 py-2">제목</th>
                  <th className="px-4 py-2">상태</th>
                  <th className="px-4 py-2">소스</th>
                  <th className="px-4 py-2">갱신</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] uppercase text-slate-700">
                        {d.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/project/docs/${encodeURIComponent(d.slug)}`}
                        className="font-medium text-ink-900 hover:text-brand-700"
                      >
                        {d.title}
                      </Link>
                      {d.summary && <div className="mt-0.5 text-xs text-slate-500">{d.summary}</div>}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[d.status]}`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {d.sourceType === 'FILE' ? '파일' : 'CMS 작성'}
                      {d.sourcePath && (
                        <div className="font-mono text-[11px] text-slate-400">{d.sourcePath}</div>
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(d.updatedAt).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
