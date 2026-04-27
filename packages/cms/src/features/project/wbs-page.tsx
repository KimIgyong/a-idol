import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownView } from './markdown-view';

const WBS_SLUG = 'implementation-a-idol-wbs';

export function WbsPage() {
  const docQ = useQuery({
    queryKey: ['admin', 'project-docs', 'detail', WBS_SLUG],
    queryFn: () => adminApi.getProjectDoc(WBS_SLUG),
  });

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold">WBS (작업 분해 구조)</h1>
        <p className="text-sm text-slate-500">
          A-idol 프로젝트의 Phase 별 task 와 진행률. 원본:{' '}
          <span className="font-mono text-xs">docs/implementation/a-idol-wbs.md</span>
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{docQ.data?.title ?? 'WBS'}</CardTitle>
          {docQ.data && (
            <Link
              to={`/project/docs/${encodeURIComponent(WBS_SLUG)}`}
              className="text-xs text-brand-600 hover:underline"
            >
              전체 화면으로 보기 →
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {docQ.isLoading ? (
            <p className="text-sm text-slate-500">불러오는 중...</p>
          ) : docQ.isError || !docQ.data ? (
            <p className="text-sm text-rose-600">
              WBS 문서를 찾을 수 없습니다. <code className="font-mono">pnpm seed</code> 를 실행해 주세요.
            </p>
          ) : (
            <MarkdownView source={docQ.data.content} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
