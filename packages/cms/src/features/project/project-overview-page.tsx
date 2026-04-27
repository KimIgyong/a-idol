import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ProjectDocCategory, ProjectDocSummaryDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORY_LABEL: Record<ProjectDocCategory, string> = {
  ADR: 'ADR (의사결정)',
  DESIGN: '설계 문서',
  IMPLEMENTATION: '구현 / WBS',
  DELIVERABLE: '산출물',
  REPORT: '리포트',
  OPS: '운영',
  OTHER: '기타',
};

const CATEGORY_ORDER: ProjectDocCategory[] = [
  'DELIVERABLE',
  'ADR',
  'DESIGN',
  'IMPLEMENTATION',
  'REPORT',
  'OPS',
  'OTHER',
];

export function ProjectOverviewPage() {
  const docsQ = useQuery({
    queryKey: ['admin', 'project-docs'],
    queryFn: () => adminApi.listProjectDocs(),
  });

  const docs = docsQ.data ?? [];
  const byCategory = new Map<ProjectDocCategory, ProjectDocSummaryDto[]>();
  for (const d of docs) {
    if (!byCategory.has(d.category)) byCategory.set(d.category, []);
    byCategory.get(d.category)!.push(d);
  }

  return (
    <div className="space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">프로젝트 관리</h1>
        <p className="text-sm text-slate-500">
          A-idol 프로젝트의 ADR / 설계 / WBS / 산출물을 한 곳에서 관리합니다.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">현황</CardTitle>
        </CardHeader>
        <CardContent>
          {docsQ.isLoading ? (
            <p className="text-sm text-slate-500">불러오는 중...</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {CATEGORY_ORDER.map((cat) => {
                const list = byCategory.get(cat) ?? [];
                if (list.length === 0) return null;
                return (
                  <div key={cat} className="rounded-md border border-slate-200 p-4">
                    <div className="text-xs uppercase text-slate-500">{CATEGORY_LABEL[cat]}</div>
                    <div className="mt-1 text-2xl font-bold">{list.length}</div>
                    <Link
                      to={cat === 'DELIVERABLE' ? '/project/deliverables' : `/project/docs?category=${cat}`}
                      className="mt-1 block text-xs text-brand-600 hover:underline"
                    >
                      목록 보기 →
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 갱신</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">분류</th>
                <th className="px-4 py-2">제목</th>
                <th className="px-4 py-2">갱신일</th>
              </tr>
            </thead>
            <tbody>
              {[...docs]
                .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                .slice(0, 8)
                .map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
                    <td className="px-4 py-2">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] uppercase text-slate-700">
                        {d.category}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/project/docs/${encodeURIComponent(d.slug)}`}
                        className="text-ink-900 hover:text-brand-700"
                      >
                        {d.title}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(d.updatedAt).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
