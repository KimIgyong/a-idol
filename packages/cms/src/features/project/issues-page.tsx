/**
 * RPT-260506 — 이슈 목록 / 칸반 보기 페이지.
 *
 * 뷰 토글: localStorage `a-idol.cms.issues.view` 에 'list' | 'kanban' 저장.
 * 칸반 DnD: HTML5 native drag-and-drop (외부 라이브러리 미사용).
 * URL 쿼리 `?issue=IIS-3` → 상세 drawer 자동 오픈.
 */
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KanbanSquare, List, Plus } from 'lucide-react';
import {
  ISSUE_KANBAN_COLUMNS,
  ISSUE_PRIORITY_VALUES,
  ISSUE_TYPE_VALUES,
  type CreateIssueDto,
  type IssueDto,
  type IssuePriority,
  type IssueStatus,
  type IssueType,
  type KanbanIssuesDto,
  type UpdateIssueDto,
} from '@a-idol/shared';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { cn } from '@/lib/utils';

type ViewMode = 'list' | 'kanban';
const VIEW_KEY = 'a-idol.cms.issues.view';

const PRIORITY_BADGE: Record<IssuePriority, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-orange-100 text-orange-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-slate-100 text-slate-600',
};

const TYPE_BADGE: Record<IssueType, string> = {
  TASK: 'bg-slate-100 text-slate-700',
  BUG: 'bg-red-50 text-red-700',
  STORY: 'bg-emerald-50 text-emerald-700',
  RISK: 'bg-amber-50 text-amber-700',
};

export function IssuesPage() {
  const { t } = useTranslation('issue');
  const [params, setParams] = useSearchParams();
  const session = useAuthStore((s) => s.session);
  const canWrite = hasRole(session, 'admin') || hasRole(session, 'operator');

  const initialView = (() => {
    const v = (typeof window !== 'undefined' && window.localStorage.getItem(VIEW_KEY)) as
      | ViewMode
      | null;
    return v === 'kanban' || v === 'list' ? v : 'list';
  })();
  const [view, setView] = useState<ViewMode>(initialView);
  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Filters (status only used in list view).
  const [filterType, setFilterType] = useState<IssueType | ''>('');
  const [filterPriority, setFilterPriority] = useState<IssuePriority | ''>('');
  const [filterStatus, setFilterStatus] = useState<IssueStatus | ''>('');
  const [searchQ, setSearchQ] = useState('');

  // Drawer / dialogs.
  const selectedKey = params.get('issue');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IssueDto | null>(null);

  return (
    <div className="space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-200 p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1 rounded px-3 py-1.5 text-sm transition-colors',
                view === 'list'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <List className="h-4 w-4" />
              {t('view.list')}
            </button>
            <button
              type="button"
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1 rounded px-3 py-1.5 text-sm transition-colors',
                view === 'kanban'
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              <KanbanSquare className="h-4 w-4" />
              {t('view.kanban')}
            </button>
          </div>
          {canWrite ? (
            <Button type="button" size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="mr-1 h-4 w-4" />
              {t('actions.create')}
            </Button>
          ) : null}
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="space-y-1">
            <Label className="text-xs">{t('filter.type')}</Label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as IssueType | '')}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">{t('filter.all')}</option>
              {ISSUE_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(`type.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('filter.priority')}</Label>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as IssuePriority | '')}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              <option value="">{t('filter.all')}</option>
              {ISSUE_PRIORITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(`priority.${v}`)}
                </option>
              ))}
            </select>
          </div>
          {view === 'list' ? (
            <div className="space-y-1">
              <Label className="text-xs">{t('filter.status')}</Label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as IssueStatus | '')}
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="">{t('filter.all')}</option>
                {(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELED'] as const).map(
                  (v) => (
                    <option key={v} value={v}>
                      {t(`status.${v}`)}
                    </option>
                  ),
                )}
              </select>
            </div>
          ) : null}
          <div className="flex-1 space-y-1 min-w-[200px]">
            <Label className="text-xs">{t('filter.search')}</Label>
            <Input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="IIS-3 or title..."
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      {view === 'list' ? (
        <IssuesListView
          filter={{
            type: filterType || undefined,
            priority: filterPriority || undefined,
            status: filterStatus || undefined,
            q: searchQ || undefined,
          }}
          onSelect={(issue) => setParams({ issue: issue.key })}
          priorityBadge={PRIORITY_BADGE}
          typeBadge={TYPE_BADGE}
        />
      ) : (
        <IssuesKanbanView
          filter={{
            type: filterType || undefined,
            priority: filterPriority || undefined,
            q: searchQ || undefined,
          }}
          canWrite={canWrite}
          onSelect={(issue) => setParams({ issue: issue.key })}
          priorityBadge={PRIORITY_BADGE}
          typeBadge={TYPE_BADGE}
        />
      )}

      {selectedKey ? (
        <IssueDetailDrawer
          idOrKey={selectedKey}
          canWrite={canWrite}
          onClose={() => {
            const next = new URLSearchParams(params);
            next.delete('issue');
            setParams(next);
          }}
          onEdit={(issue) => setEditing(issue)}
        />
      ) : null}

      {showCreate ? (
        <IssueFormDialog
          mode="create"
          onClose={() => setShowCreate(false)}
        />
      ) : null}
      {editing ? (
        <IssueFormDialog mode="edit" initial={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}

// -- List view --------------------------------------------------------------
function IssuesListView({
  filter,
  onSelect,
  priorityBadge,
  typeBadge,
}: {
  filter: {
    type?: IssueType;
    priority?: IssuePriority;
    status?: IssueStatus;
    q?: string;
  };
  onSelect: (issue: IssueDto) => void;
  priorityBadge: Record<IssuePriority, string>;
  typeBadge: Record<IssueType, string>;
}) {
  const { t } = useTranslation('issue');
  const q = useQuery({
    queryKey: ['admin', 'issues', 'list', filter],
    queryFn: () => adminApi.listIssues(filter),
  });

  if (q.isLoading) {
    return <p className="text-sm text-slate-500">Loading...</p>;
  }
  if (q.error) {
    return <p className="text-sm text-red-600">{(q.error as Error).message}</p>;
  }
  const rows = q.data ?? [];
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">{t('empty')}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-3 py-2 text-left">{t('field.key')}</th>
            <th className="px-3 py-2 text-left">{t('field.title')}</th>
            <th className="px-3 py-2 text-left">{t('field.type')}</th>
            <th className="px-3 py-2 text-left">{t('field.status')}</th>
            <th className="px-3 py-2 text-left">{t('field.priority')}</th>
            <th className="px-3 py-2 text-left">{t('field.assignee')}</th>
            <th className="px-3 py-2 text-left">{t('field.dueDate')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer hover:bg-slate-50"
              onClick={() => onSelect(r)}
            >
              <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.key}</td>
              <td className="px-3 py-2 font-medium">{r.title}</td>
              <td className="px-3 py-2">
                <span className={cn('rounded px-2 py-0.5 text-xs', typeBadge[r.type])}>
                  {t(`type.${r.type}`)}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">{t(`status.${r.status}`)}</td>
              <td className="px-3 py-2">
                <span className={cn('rounded px-2 py-0.5 text-xs', priorityBadge[r.priority])}>
                  {r.priority}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">
                {r.assigneeName ?? <span className="text-slate-400">{t('field.unassigned')}</span>}
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">{r.dueDate ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -- Kanban view ------------------------------------------------------------
function IssuesKanbanView({
  filter,
  canWrite,
  onSelect,
  priorityBadge,
  typeBadge,
}: {
  filter: { type?: IssueType; priority?: IssuePriority; q?: string };
  canWrite: boolean;
  onSelect: (issue: IssueDto) => void;
  priorityBadge: Record<IssuePriority, string>;
  typeBadge: Record<IssueType, string>;
}) {
  const { t } = useTranslation('issue');
  const queryClient = useQueryClient();
  const boardQ = useQuery({
    queryKey: ['admin', 'issues', 'board', filter],
    queryFn: () => adminApi.getIssueBoard(filter),
  });

  const moveM = useMutation({
    mutationFn: (args: { id: string; toStatus: IssueStatus; toIndex: number }) =>
      adminApi.moveIssue(args.id, { to_status: args.toStatus, to_index: args.toIndex }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'issues'] });
    },
    onError: (err) => {
      alert(t('moveError', { message: err instanceof Error ? err.message : 'unknown' }));
    },
  });

  const board: KanbanIssuesDto = boardQ.data ?? { columns: [] };

  const handleDrop = (toStatus: IssueStatus, toIndex: number, draggedId: string) => {
    moveM.mutate({ id: draggedId, toStatus, toIndex });
  };

  if (boardQ.isLoading) return <p className="text-sm text-slate-500">Loading...</p>;
  if (boardQ.error) {
    return <p className="text-sm text-red-600">{(boardQ.error as Error).message}</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
      {ISSUE_KANBAN_COLUMNS.map((status) => {
        const col = board.columns.find((c) => c.status === status);
        const issues = col?.issues ?? [];
        return (
          <KanbanColumn
            key={status}
            status={status}
            issues={issues}
            canWrite={canWrite}
            onDropIssue={handleDrop}
            onSelect={onSelect}
            priorityBadge={priorityBadge}
            typeBadge={typeBadge}
            label={t(`status.${status}`)}
            countLabel={String(issues.length)}
            typeLabelOf={(ty: IssueType) => t(`type.${ty}`)}
          />
        );
      })}
    </div>
  );
}

function KanbanColumn({
  status,
  issues,
  canWrite,
  onDropIssue,
  onSelect,
  priorityBadge,
  typeBadge,
  label,
  countLabel,
  typeLabelOf,
}: {
  status: IssueStatus;
  issues: IssueDto[];
  canWrite: boolean;
  onDropIssue: (toStatus: IssueStatus, toIndex: number, draggedId: string) => void;
  onSelect: (issue: IssueDto) => void;
  priorityBadge: Record<IssuePriority, string>;
  typeBadge: Record<IssueType, string>;
  label: string;
  countLabel: string;
  typeLabelOf: (ty: IssueType) => string;
}) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const onDragOver = (e: React.DragEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onCardDragOver = (idx: number) => (e: React.DragEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(idx);
  };

  const onColumnDragOver = (e: React.DragEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    setDragOverIndex(issues.length);
  };

  const onDrop = (e: React.DragEvent) => {
    if (!canWrite) return;
    e.preventDefault();
    const id = e.dataTransfer.getData('text/issue-id');
    const idx = dragOverIndex ?? issues.length;
    setDragOverIndex(null);
    if (id) onDropIssue(status, idx, id);
  };

  return (
    <div
      className="flex min-h-[300px] flex-col rounded-md bg-slate-100 p-2"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
        <span className="rounded-full bg-white px-2 text-xs text-slate-500">{countLabel}</span>
      </div>
      <div className="flex-1 space-y-2" onDragOver={onColumnDragOver}>
        {issues.map((issue, idx) => (
          <div key={issue.id} onDragOver={onCardDragOver(idx)}>
            {dragOverIndex === idx ? (
              <div className="mb-1 h-1 rounded bg-brand-400" />
            ) : null}
            <button
              type="button"
              draggable={canWrite}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/issue-id', issue.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onClick={() => onSelect(issue)}
              className="w-full cursor-pointer rounded border border-slate-200 bg-white p-2 text-left shadow-sm hover:border-brand-400"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500">{issue.key}</span>
                <span
                  className={cn('rounded px-1.5 py-0.5 text-[11px]', priorityBadge[issue.priority])}
                >
                  {issue.priority}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-2">{issue.title}</p>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className={cn('rounded px-1.5 py-0.5', typeBadge[issue.type])}>
                  {typeLabelOf(issue.type)}
                </span>
                <span className="text-slate-500">{issue.assigneeName ?? '—'}</span>
              </div>
            </button>
          </div>
        ))}
        {dragOverIndex === issues.length ? (
          <div className="h-1 rounded bg-brand-400" />
        ) : null}
        {issues.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-slate-400">—</p>
        ) : null}
      </div>
    </div>
  );
}

// -- Drawer / Detail --------------------------------------------------------
function IssueDetailDrawer({
  idOrKey,
  canWrite,
  onClose,
  onEdit,
}: {
  idOrKey: string;
  canWrite: boolean;
  onClose: () => void;
  onEdit: (issue: IssueDto) => void;
}) {
  const { t } = useTranslation('issue');
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ['admin', 'issues', 'detail', idOrKey],
    queryFn: () => adminApi.getIssue(idOrKey),
  });
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const deleteM = useMutation({
    mutationFn: (id: string) => adminApi.deleteIssue(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'issues'] });
      onClose();
    },
  });

  const issue = q.data;

  return (
    <Modal
      open
      onClose={onClose}
      title={issue ? `${issue.key} — ${issue.title}` : idOrKey}
      size="lg"
      footer={
        issue ? (
          <div className="flex justify-end gap-2">
            {canWrite ? (
              <Button type="button" variant="outline" onClick={() => onEdit(issue)}>
                {t('actions.edit')}
              </Button>
            ) : null}
            {isAdmin ? (
              <Button
                type="button"
                variant="destructive"
                disabled={deleteM.isPending}
                onClick={() => {
                  if (window.confirm(t('deleteConfirm', { key: issue.key }))) {
                    deleteM.mutate(issue.id);
                  }
                }}
              >
                {t('actions.delete')}
              </Button>
            ) : null}
            <Button type="button" onClick={onClose}>
              {t('actions.close')}
            </Button>
          </div>
        ) : null
      }
    >
      {q.isLoading ? <p className="text-sm text-slate-500">Loading...</p> : null}
      {q.error ? <p className="text-sm text-red-600">{(q.error as Error).message}</p> : null}
      {issue ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">{t('field.type')}</dt>
          <dd>{t(`type.${issue.type}`)}</dd>
          <dt className="text-slate-500">{t('field.status')}</dt>
          <dd>{t(`status.${issue.status}`)}</dd>
          <dt className="text-slate-500">{t('field.priority')}</dt>
          <dd>{t(`priority.${issue.priority}`)}</dd>
          <dt className="text-slate-500">{t('field.assignee')}</dt>
          <dd>{issue.assigneeName ?? t('field.unassigned')}</dd>
          <dt className="text-slate-500">{t('field.reporter')}</dt>
          <dd>{issue.reporterName ?? '—'}</dd>
          <dt className="text-slate-500">{t('field.dueDate')}</dt>
          <dd>{issue.dueDate ?? '—'}</dd>
          <dt className="text-slate-500">{t('field.labels')}</dt>
          <dd>{issue.labels ?? '—'}</dd>
          <dt className="text-slate-500">{t('field.createdAt')}</dt>
          <dd className="text-xs text-slate-500">{issue.createdAt}</dd>
          <dt className="text-slate-500">{t('field.updatedAt')}</dt>
          <dd className="text-xs text-slate-500">{issue.updatedAt}</dd>
          <dt className="col-span-2 mt-3 text-slate-500">{t('field.description')}</dt>
          <dd className="col-span-2 whitespace-pre-wrap rounded border border-slate-100 bg-slate-50 p-3 text-sm">
            {issue.description ?? '—'}
          </dd>
        </dl>
      ) : null}
    </Modal>
  );
}

// -- Create / Edit dialog ---------------------------------------------------
function IssueFormDialog({
  mode,
  initial,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial?: IssueDto;
  onClose: () => void;
}) {
  const { t } = useTranslation('issue');
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [type, setType] = useState<IssueType>(initial?.type ?? 'TASK');
  const [status, setStatus] = useState<IssueStatus>(initial?.status ?? 'BACKLOG');
  const [priority, setPriority] = useState<IssuePriority>(initial?.priority ?? 'P2');
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? '');
  const [labels, setLabels] = useState(initial?.labels ?? '');

  const createM = useMutation({
    mutationFn: (body: CreateIssueDto) => adminApi.createIssue(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'issues'] });
      onClose();
    },
  });
  const updateM = useMutation({
    mutationFn: (args: { id: string; body: UpdateIssueDto }) =>
      adminApi.updateIssue(args.id, args.body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'issues'] });
      onClose();
    },
  });

  const submit = () => {
    const body = {
      title,
      description: description || null,
      type,
      status,
      priority,
      due_date: dueDate || null,
      labels: labels || null,
    };
    if (mode === 'create') {
      createM.mutate(body as CreateIssueDto);
    } else if (initial) {
      updateM.mutate({ id: initial.id, body });
    }
  };

  const pending = createM.isPending || updateM.isPending;
  const error = (createM.error ?? updateM.error) as Error | null;

  return (
    <Modal
      open
      onClose={onClose}
      title={mode === 'create' ? t('createDialog.title') : t('editDialog.title')}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t('actions.cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={pending || !title.trim()}>
            {t('actions.save')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>{t('field.title')}</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>{t('field.type')}</Label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IssueType)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {ISSUE_TYPE_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(`type.${v}`)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>{t('field.status')}</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IssueStatus)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELED'] as const).map(
                (v) => (
                  <option key={v} value={v}>
                    {t(`status.${v}`)}
                  </option>
                ),
              )}
            </select>
          </div>
          <div className="space-y-1">
            <Label>{t('field.priority')}</Label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {ISSUE_PRIORITY_VALUES.map((v) => (
                <option key={v} value={v}>
                  {t(`priority.${v}`)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{t('field.dueDate')}</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>{t('field.labels')}</Label>
            <Input value={labels} onChange={(e) => setLabels(e.target.value)} placeholder="bug,urgent" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>{t('field.description')}</Label>
          <textarea
            value={description ?? ''}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      </div>
    </Modal>
  );
}
