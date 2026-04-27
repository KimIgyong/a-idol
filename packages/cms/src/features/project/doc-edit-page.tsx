import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ProjectDocCategory, ProjectDocStatus, UpdateProjectDocDto } from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ErrorLine } from '@/components/ui/error-line';
import { MarkdownView } from './markdown-view';

const CATEGORY_VALUES: ProjectDocCategory[] = [
  'ADR',
  'DESIGN',
  'IMPLEMENTATION',
  'DELIVERABLE',
  'REPORT',
  'OPS',
  'OTHER',
];
const STATUS_VALUES: ProjectDocStatus[] = ['DRAFT', 'REVIEW', 'APPROVED', 'ARCHIVED'];

export function DocEditPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const docQ = useQuery({
    queryKey: ['admin', 'project-docs', 'detail', slug],
    queryFn: () => adminApi.getProjectDoc(slug),
    enabled: !!slug,
  });

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<ProjectDocCategory>('DELIVERABLE');
  const [status, setStatus] = useState<ProjectDocStatus>('DRAFT');
  const [tags, setTags] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (docQ.data) {
      setTitle(docQ.data.title);
      setSummary(docQ.data.summary ?? '');
      setContent(docQ.data.content);
      setCategory(docQ.data.category);
      setStatus(docQ.data.status);
      setTags(docQ.data.tags ?? '');
    }
  }, [docQ.data]);

  const updateMut = useMutation({
    mutationFn: (body: UpdateProjectDocDto) =>
      adminApi.updateProjectDoc(docQ.data!.id, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['admin', 'project-docs'] });
      navigate(`/project/docs/${encodeURIComponent(updated.slug)}`);
    },
  });

  if (docQ.isLoading) return <div className="p-6 text-sm text-slate-500">불러오는 중...</div>;
  if (docQ.isError || !docQ.data) {
    return (
      <div className="space-y-3 p-6">
        <p className="text-sm text-rose-600">문서를 찾을 수 없습니다.</p>
        <Link to="/project/docs" className="text-sm text-brand-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  const sourceType = docQ.data.sourceType;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMut.mutate({
      title,
      summary: summary || null,
      content,
      category,
      status,
      tags: tags || null,
    });
  };

  return (
    <div className="space-y-4 p-6">
      <Link to={`/project/docs/${encodeURIComponent(slug)}`} className="text-xs text-slate-500 hover:text-brand-700">
        ← 상세로
      </Link>

      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">문서 편집 — v{docQ.data.version}</CardTitle>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPreview((v) => !v)}
                >
                  {preview ? '편집 모드' : '미리보기'}
                </Button>
                <Button type="submit" size="sm" disabled={updateMut.isPending}>
                  {updateMut.isPending ? '저장 중...' : '저장'}
                </Button>
              </div>
            </div>
            {sourceType === 'FILE' && docQ.data.sourcePath && (
              <p className="mt-1 text-xs text-amber-700">
                ⚠ 이 문서는 파일 기반 (sourcePath:{' '}
                <span className="font-mono">{docQ.data.sourcePath}</span>) 입니다. CMS 에서 저장하면 DB
                의 사본이 갱신되며, 다음 seed 실행 시 파일 내용으로 덮어쓰여질 수 있습니다.
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="title">제목</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
              </div>
              <div>
                <Label htmlFor="category">분류</Label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProjectDocCategory)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  {CATEGORY_VALUES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="status">상태</Label>
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectDocStatus)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  {STATUS_VALUES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="tags">태그</Label>
                <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} maxLength={500} />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="summary">요약</Label>
                <Input id="summary" value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={500} />
              </div>
            </div>

            <div>
              <Label htmlFor="content">본문 (마크다운)</Label>
              {preview ? (
                <div className="rounded-md border border-slate-200 p-4">
                  <MarkdownView source={content} />
                </div>
              ) : (
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={24}
                  className="w-full resize-y rounded-md border border-slate-300 p-3 font-mono text-[13px] leading-relaxed"
                />
              )}
            </div>

            {updateMut.isError && <ErrorLine error={updateMut.error} prefix="저장 실패" />}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
