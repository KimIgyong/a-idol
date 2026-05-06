import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Pin, PinOff, Plus, Search } from 'lucide-react';
import { adminApi, type ProjectNoteDto } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { hasRole, useAuthStore } from '@/features/auth/auth-store';
import { cn } from '@/lib/utils';
import {
  RichEditor,
  RichHtmlView,
  type AttachmentRef,
} from '@/shared/rich-editor/rich-editor';

type Category = ProjectNoteDto['category'];
const CATEGORIES: Category[] = ['NOTE', 'MEETING', 'DECISION', 'LINK', 'OTHER'];

const CATEGORY_BADGE: Record<Category, string> = {
  NOTE: 'bg-slate-100 text-slate-700',
  MEETING: 'bg-blue-100 text-blue-700',
  DECISION: 'bg-emerald-100 text-emerald-700',
  LINK: 'bg-amber-100 text-amber-700',
  OTHER: 'bg-purple-100 text-purple-700',
};

export function NotesPage() {
  const { t } = useTranslation('note');
  const queryClient = useQueryClient();
  const session = useAuthStore((s) => s.session);
  const isAdmin = hasRole(session, 'admin');

  const [category, setCategory] = useState<Category | ''>('');
  const [pinnedOnly, setPinnedOnly] = useState(false);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<ProjectNoteDto | 'new' | null>(null);
  const [viewing, setViewing] = useState<ProjectNoteDto | null>(null);

  const listQ = useQuery({
    queryKey: ['admin', 'project-notes', 'list', { category, pinnedOnly, q }],
    queryFn: () =>
      adminApi.listProjectNotes({
        category: category || undefined,
        pinnedOnly,
        q: q || undefined,
      }),
  });

  const pinM = useMutation({
    mutationFn: (args: { id: string; pinned: boolean }) =>
      adminApi.togglePinProjectNote(args.id, args.pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'project-notes'] }),
  });

  const deleteM = useMutation({
    mutationFn: (id: string) => adminApi.deleteProjectNote(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'project-notes'] });
      setViewing(null);
    },
  });

  const rows = useMemo(() => listQ.data ?? [], [listQ.data]);
  const pinned = useMemo(() => rows.filter((r) => r.pinned), [rows]);
  const others = useMemo(() => rows.filter((r) => !r.pinned), [rows]);

  return (
    <div className="space-y-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus className="mr-1 h-4 w-4" />
          {t('actions.create')}
        </Button>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('filter.search')}
              className="w-64"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | '')}
            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          >
            <option value="">{t('filter.all_categories')}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`category.${c}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
            />
            {t('filter.pinned_only')}
          </label>
        </CardContent>
      </Card>

      {listQ.isLoading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : listQ.error ? (
        <p className="text-sm text-red-600">{(listQ.error as Error).message}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          {pinned.length > 0 ? (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Pin className="mr-1 inline h-3 w-3" />
                {t('section.pinned')}
              </h3>
              {pinned.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  onClick={() => setViewing(n)}
                  onTogglePin={() => pinM.mutate({ id: n.id, pinned: false })}
                />
              ))}
            </>
          ) : null}
          {others.length > 0 ? (
            <>
              {pinned.length > 0 ? (
                <h3 className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {t('section.all')}
                </h3>
              ) : null}
              {others.map((n) => (
                <NoteCard
                  key={n.id}
                  note={n}
                  onClick={() => setViewing(n)}
                  onTogglePin={() => pinM.mutate({ id: n.id, pinned: true })}
                />
              ))}
            </>
          ) : null}
        </div>
      )}

      {editing ? (
        <NoteFormDialog
          mode={editing === 'new' ? 'create' : 'edit'}
          initial={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {viewing ? (
        <Modal
          open
          onClose={() => setViewing(null)}
          title={viewing.title}
          size="lg"
          footer={
            <div className="flex justify-end gap-2">
              {(isAdmin || viewing.authorAdminId === session?.user.id) ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditing(viewing);
                      setViewing(null);
                    }}
                  >
                    {t('actions.edit')}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      if (window.confirm(t('deleteConfirm', { title: viewing.title }))) {
                        deleteM.mutate(viewing.id);
                      }
                    }}
                  >
                    {t('actions.delete')}
                  </Button>
                </>
              ) : null}
              <Button type="button" onClick={() => setViewing(null)}>
                {t('actions.close')}
              </Button>
            </div>
          }
        >
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <span className={cn('rounded px-2 py-0.5', CATEGORY_BADGE[viewing.category])}>
              {t(`category.${viewing.category}`)}
            </span>
            <span>✍ {viewing.authorName ?? '—'}</span>
            <span>· {new Date(viewing.updatedAt).toLocaleString()}</span>
          </div>
          <RichHtmlView html={viewing.body} />
        </Modal>
      ) : null}
    </div>
  );
}

function NoteCard({
  note,
  onClick,
  onTogglePin,
}: {
  note: ProjectNoteDto;
  onClick: () => void;
  onTogglePin: () => void;
}) {
  const { t } = useTranslation('note');
  const preview = note.body.replace(/<[^>]+>/g, '').slice(0, 140);
  return (
    <Card className="cursor-pointer hover:border-brand-300" onClick={onClick}>
      <CardContent className="flex flex-col gap-1 pt-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('rounded px-2 py-0.5 text-xs', CATEGORY_BADGE[note.category])}>
              {t(`category.${note.category}`)}
            </span>
            <h3 className="text-sm font-semibold text-slate-900">{note.title}</h3>
          </div>
          <button
            type="button"
            title={note.pinned ? t('actions.unpin') : t('actions.pin')}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="text-slate-400 hover:text-amber-500"
          >
            {note.pinned ? <Pin className="h-4 w-4 fill-amber-500 text-amber-500" /> : <PinOff className="h-4 w-4" />}
          </button>
        </div>
        <p className="line-clamp-2 text-xs text-slate-500">{preview || '—'}</p>
        <div className="text-[10px] text-slate-400">
          ✍ {note.authorName ?? '—'} · {new Date(note.updatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function NoteFormDialog({
  mode,
  initial,
  onClose,
}: {
  mode: 'create' | 'edit';
  initial?: ProjectNoteDto;
  onClose: () => void;
}) {
  const { t } = useTranslation('note');
  const queryClient = useQueryClient();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'NOTE');
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [attachments, setAttachments] = useState<AttachmentRef[]>([]);

  const handleUpload = async (file: File): Promise<AttachmentRef> => {
    const r = await adminApi.uploadAttachment(file, initial ? 'NOTE' : 'DRAFT', initial?.id);
    return {
      id: r.id,
      filename: r.filename,
      mimeType: r.mimeType,
      sizeBytes: r.sizeBytes,
      url: r.url,
    };
  };

  const createM = useMutation({
    mutationFn: () =>
      adminApi.createProjectNote({
        title,
        body,
        category,
        pinned,
        attachment_ids: attachments.length ? attachments.map((a) => a.id) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'project-notes'] });
      onClose();
    },
  });
  const updateM = useMutation({
    mutationFn: () =>
      adminApi.updateProjectNote(initial!.id, {
        title,
        body,
        category,
        pinned,
        attachment_ids: attachments.length ? attachments.map((a) => a.id) : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'project-notes'] });
      onClose();
    },
  });

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
          <Button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() => (mode === 'create' ? createM.mutate() : updateM.mutate())}
          >
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>{t('field.category')}</Label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            {t('field.pinned')}
          </label>
        </div>
        <div className="space-y-1">
          <Label>{t('field.body')}</Label>
          <RichEditor
            value={body}
            onChange={setBody}
            onUploadFile={handleUpload}
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error.message}</p> : null}
      </div>
    </Modal>
  );
}
