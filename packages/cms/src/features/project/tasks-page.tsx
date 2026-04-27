import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/admin-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const WBS_SLUG = 'implementation-a-idol-wbs';

interface TaskRow {
  id: string;
  title: string;
  scope: string;
  priority: string;
  estimate: string;
  deps: string;
  phase: string;
  progress?: string;
  note?: string;
}

const PHASE_HEADER_RE = /^###\s+(Phase[^\n]+)/;
const TASK_ROW_RE = /^\|\s+(T-\d{3})\s+\|\s+([^|]+?)\s+\|\s+([^|]+?)\s+\|\s+([^|]+?)\s+\|\s+([^|]+?)\s+\|\s+([^|]*?)\s+\|/;
const PROGRESS_ROW_RE = /^\|\s+(T-\d{3})\s+\|\s+(🟢|🟡|🔴|⏸|🟢|🟡|🔴)\s*([0-9]+%?)?\s*\|\s+([^|]+?)\s+\|/;

function parseTasks(md: string): TaskRow[] {
  const lines = md.split('\n');
  const tasks: Record<string, TaskRow> = {};
  let phase = '';
  for (const line of lines) {
    const ph = line.match(PHASE_HEADER_RE);
    if (ph) {
      phase = ph[1].trim();
      continue;
    }
    const m = line.match(TASK_ROW_RE);
    if (m) {
      const id = m[1];
      // skip header rows like `| ID | Task | scope ... |`
      if (id === 'ID' || /^Task/.test(m[2])) continue;
      tasks[id] = {
        id,
        title: m[2].trim(),
        scope: m[3].trim(),
        priority: m[4].trim(),
        estimate: m[5].trim(),
        deps: m[6].trim(),
        phase,
      };
      continue;
    }
    const p = line.match(PROGRESS_ROW_RE);
    if (p) {
      const id = p[1];
      if (!tasks[id]) {
        tasks[id] = { id, title: '', scope: '', priority: '', estimate: '', deps: '', phase };
      }
      tasks[id].progress = `${p[2]} ${p[3] ?? ''}`.trim();
      tasks[id].note = p[4].trim();
    }
  }
  return Object.values(tasks).sort((a, b) => a.id.localeCompare(b.id));
}

export function TasksPage() {
  const docQ = useQuery({
    queryKey: ['admin', 'project-docs', 'detail', WBS_SLUG],
    queryFn: () => adminApi.getProjectDoc(WBS_SLUG),
  });

  const [filter, setFilter] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<string>('');

  const tasks = useMemo(() => (docQ.data ? parseTasks(docQ.data.content) : []), [docQ.data]);

  const phases = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => t.phase && set.add(t.phase));
    return Array.from(set);
  }, [tasks]);

  const filtered = tasks.filter((t) => {
    if (phaseFilter && t.phase !== phaseFilter) return false;
    if (filter) {
      const q = filter.toLowerCase();
      if (
        !t.id.toLowerCase().includes(q) &&
        !t.title.toLowerCase().includes(q) &&
        !(t.note ?? '').toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-2xl font-bold">작업 태스크 (WBS 추출)</h1>
        <p className="text-sm text-slate-500">
          [`docs/implementation/a-idol-wbs.md`] 의 task 표를 파싱해 검색/필터 가능한 표로 표시합니다.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="검색 (ID / 제목 / 비고)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-72"
        />
        <select
          value={phaseFilter}
          onChange={(e) => setPhaseFilter(e.target.value)}
          className="h-10 rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="">모든 Phase</option>
          {phases.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          {filtered.length} / {tasks.length} task
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Task 목록</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {docQ.isLoading ? (
            <p className="px-4 py-3 text-sm text-slate-500">불러오는 중...</p>
          ) : tasks.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">파싱된 태스크가 없습니다.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-left uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">ID</th>
                  <th className="px-3 py-2">Phase</th>
                  <th className="px-3 py-2">제목</th>
                  <th className="px-3 py-2">스코프</th>
                  <th className="px-3 py-2">P</th>
                  <th className="px-3 py-2">예상</th>
                  <th className="px-3 py-2">Deps</th>
                  <th className="px-3 py-2">진행/메모</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2 font-mono">{t.id}</td>
                    <td className="px-3 py-2 text-slate-500">{t.phase}</td>
                    <td className="px-3 py-2 text-ink-900">{t.title}</td>
                    <td className="px-3 py-2 text-slate-600">{t.scope}</td>
                    <td className="px-3 py-2">{t.priority}</td>
                    <td className="px-3 py-2 text-slate-600">{t.estimate}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{t.deps}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {t.progress && <div className="font-semibold text-ink-700">{t.progress}</div>}
                      {t.note && <div className="text-[11px]">{t.note}</div>}
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
