import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CreateProjectDocDto, ProjectDocStatus } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorLine } from '@/components/ui/error-line';

const QK = ['admin', 'project-docs', { category: 'DELIVERABLE' }] as const;

const STATUS_BADGE: Record<ProjectDocStatus, string> = {
  DRAFT: 'bg-amber-50 text-amber-700',
  REVIEW: 'bg-blue-50 text-blue-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

export function DeliverablesPage() {
  const session = useAuthStore((s) => s.session);
  const canEdit = hasRole(session, 'admin');
  const qc = useQueryClient();

  const docsQ = useQuery({
    queryKey: QK,
    queryFn: () => adminApi.listProjectDocs({ category: 'DELIVERABLE' }),
  });

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateProjectDocDto>({
    slug: '',
    title: '',
    category: 'DELIVERABLE',
    status: 'DRAFT',
    sourceType: 'INLINE',
    summary: '',
    content: '# 새 산출물\n\n작성 내용을 여기에 적습니다.\n',
    tags: '',
  });

  const createMut = useMutation({
    mutationFn: (body: CreateProjectDocDto) => adminApi.createProjectDoc(body),
    onSuccess: () => {
      setCreating(false);
      setForm({
        slug: '',
        title: '',
        category: 'DELIVERABLE',
        status: 'DRAFT',
        sourceType: 'INLINE',
        summary: '',
        content: '# 새 산출물\n\n작성 내용을 여기에 적습니다.\n',
        tags: '',
      });
      qc.invalidateQueries({ queryKey: ['admin', 'project-docs'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminApi.deleteProjectDoc(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'project-docs'] }),
  });

  const docs = docsQ.data ?? [];

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({
      ...form,
      summary: form.summary || null,
      tags: form.tags || null,
    });
  };

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">산출물 관리</h1>
          <p className="text-sm text-slate-500">
            수행계획서 · 요구사항명세서 · 기능정의서 · 개발계획서 · 중간보고서 등 프로젝트 산출물을 작성/편집합니다.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={() => setCreating((v) => !v)}>
            {creating ? '취소' : '새 산출물'}
          </Button>
        )}
      </header>

      {creating && canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">새 산출물 작성</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <Label htmlFor="slug">slug (영문/숫자/-)</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    required
                    pattern="[a-z0-9][a-z0-9-_/.]*"
                    placeholder="deliverable-functional-spec"
                  />
                </div>
                <div>
                  <Label htmlFor="title">제목</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="summary">요약 (선택)</Label>
                  <Input
                    id="summary"
                    value={form.summary ?? ''}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    maxLength={500}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="content">본문 (마크다운)</Label>
                  <textarea
                    id="content"
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    rows={10}
                    required
                    className="w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-[13px]"
                  />
                </div>
              </div>
              {createMut.isError && <ErrorLine error={createMut.error} prefix="작성 실패" />}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCreating(false)}>
                  취소
                </Button>
                <Button type="submit" size="sm" disabled={createMut.isPending}>
                  {createMut.isPending ? '저장 중...' : '저장'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">산출물 목록 ({docs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {docsQ.isLoading ? (
            <p className="px-4 py-3 text-sm text-slate-500">불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">등록된 산출물이 없습니다.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">제목</th>
                  <th className="px-4 py-2">상태</th>
                  <th className="px-4 py-2">소스</th>
                  <th className="px-4 py-2">버전</th>
                  <th className="px-4 py-2">갱신</th>
                  {canEdit && <th className="px-4 py-2">작업</th>}
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b border-slate-100">
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
                      {d.sourceType === 'FILE' ? '파일' : 'CMS'}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">v{d.version}</td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(d.updatedAt).toLocaleDateString('ko-KR')}
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Link to={`/project/docs/${encodeURIComponent(d.slug)}/edit`}>
                            <Button size="sm" variant="outline">
                              편집
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm(`정말 "${d.title}" 산출물을 삭제할까요?`)) {
                                deleteMut.mutate(d.id);
                              }
                            }}
                            disabled={deleteMut.isPending}
                          >
                            삭제
                          </Button>
                        </div>
                      </td>
                    )}
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
