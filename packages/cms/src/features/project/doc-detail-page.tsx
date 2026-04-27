import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminApi } from '@/lib/admin-api';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MarkdownView } from './markdown-view';

export function DocDetailPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const session = useAuthStore((s) => s.session);
  const canEdit = hasRole(session, 'admin');

  const docQ = useQuery({
    queryKey: ['admin', 'project-docs', 'detail', slug],
    queryFn: () => adminApi.getProjectDoc(slug),
    enabled: !!slug,
  });

  if (docQ.isLoading) {
    return <div className="p-6 text-sm text-slate-500">불러오는 중...</div>;
  }
  if (docQ.isError || !docQ.data) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-rose-600">문서를 찾을 수 없습니다 ({slug}).</p>
        <Link to="/project/docs" className="text-sm text-brand-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const doc = docQ.data;

  return (
    <div className="space-y-4 p-6">
      <Link to="/project/docs" className="text-xs text-slate-500 hover:text-brand-700">
        ← 목록으로
      </Link>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className="rounded bg-slate-100 px-2 py-0.5 uppercase text-slate-700">
                {doc.category}
              </span>
              <span className="text-slate-500">{doc.status}</span>
              <span className="text-slate-400">v{doc.version}</span>
            </div>
            <CardTitle className="text-xl">{doc.title}</CardTitle>
            {doc.summary && <p className="mt-1 text-sm text-slate-500">{doc.summary}</p>}
            <div className="mt-2 text-xs text-slate-500">
              <span>slug: <span className="font-mono">{doc.slug}</span></span>
              {doc.sourcePath && (
                <span className="ml-3">
                  source: <span className="font-mono">{doc.sourcePath}</span>
                </span>
              )}
              <span className="ml-3">갱신: {new Date(doc.updatedAt).toLocaleString('ko-KR')}</span>
            </div>
          </div>
          {canEdit && (
            <Link to={`/project/docs/${encodeURIComponent(doc.slug)}/edit`}>
              <Button size="sm" variant="outline">
                편집
              </Button>
            </Link>
          )}
        </CardHeader>
        <CardContent className="border-t border-slate-100 pt-4">
          <MarkdownView source={doc.content} />
        </CardContent>
      </Card>
    </div>
  );
}
