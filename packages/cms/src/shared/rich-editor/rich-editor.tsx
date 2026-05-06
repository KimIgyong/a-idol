import { useCallback, useEffect, useRef } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AttachmentRef {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

export interface RichEditorProps {
  value: string;
  onChange: (html: string) => void;
  /** 파일/이미지 업로드 콜백. tiptap 에 url 을 inline 삽입할 때 호출. */
  onUploadFile: (file: File) => Promise<AttachmentRef>;
  /** 비-이미지 첨부 노출 리스트. */
  attachments: AttachmentRef[];
  onAttachmentsChange: (next: AttachmentRef[]) => void;
  className?: string;
  placeholder?: string;
}

export function RichEditor({
  value,
  onChange,
  onUploadFile,
  attachments,
  onAttachmentsChange,
  className,
  placeholder,
}: RichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class:
          'min-h-[160px] max-h-[400px] overflow-y-auto rounded-b-md border border-t-0 border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none prose prose-sm max-w-none',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== value) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
  }, [editor, value]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      try {
        const ref = await onUploadFile(file);
        editor?.chain().focus().setImage({ src: ref.url, alt: ref.filename }).run();
      } catch (e) {
        alert((e as Error).message);
      }
    },
    [editor, onUploadFile],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        const ref = await onUploadFile(file);
        onAttachmentsChange([...attachments, ref]);
      } catch (e) {
        alert((e as Error).message);
      }
    },
    [attachments, onAttachmentsChange, onUploadFile],
  );

  const onPickImage = () => imageInputRef.current?.click();
  const onPickFile = () => fileInputRef.current?.click();

  const insertLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL', prev ?? 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className={cn('flex flex-col', className)}>
      <Toolbar
        editor={editor}
        onImage={onPickImage}
        onFile={onPickFile}
        onLink={insertLink}
      />
      {placeholder && editor.isEmpty ? (
        <div className="pointer-events-none -mb-[160px] px-3 pt-3 text-sm text-slate-400">{placeholder}</div>
      ) : null}
      <EditorContent editor={editor} />
      {attachments.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span className="truncate">📎 {a.filename} ({Math.round(a.sizeBytes / 1024)} KB)</span>
              <button
                type="button"
                onClick={() => onAttachmentsChange(attachments.filter((x) => x.id !== a.id))}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImageUpload(f);
          e.target.value = '';
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFileUpload(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function Toolbar({
  editor,
  onImage,
  onFile,
  onLink,
}: {
  editor: Editor;
  onImage: () => void;
  onFile: () => void;
  onLink: () => void;
}) {
  const btn = (
    active: boolean,
    onClick: () => void,
    Icon: typeof Bold,
    title: string,
  ) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded text-slate-700 hover:bg-slate-200',
        active && 'bg-slate-200 text-slate-900',
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className="flex flex-wrap gap-0.5 rounded-t-md border border-slate-300 bg-slate-50 px-1 py-1">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold, 'Bold')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic, 'Italic')}
      {btn(
        editor.isActive('underline' as never),
        () => editor.chain().focus().toggleMark('underline' as never).run(),
        Underline,
        'Underline',
      )}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), Strikethrough, 'Strike')}
      <span className="mx-1 h-6 w-px bg-slate-300" />
      {btn(
        editor.isActive('heading', { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        Heading1,
        'Heading 1',
      )}
      {btn(
        editor.isActive('heading', { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        Heading2,
        'Heading 2',
      )}
      <span className="mx-1 h-6 w-px bg-slate-300" />
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List, 'Bullet list')}
      {btn(
        editor.isActive('orderedList'),
        () => editor.chain().focus().toggleOrderedList().run(),
        ListOrdered,
        'Ordered list',
      )}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), Quote, 'Quote')}
      {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), Code, 'Code')}
      <span className="mx-1 h-6 w-px bg-slate-300" />
      {btn(false, onImage, ImageIcon, 'Insert image')}
      {btn(false, onFile, Paperclip, 'Attach file')}
      {btn(editor.isActive('link'), onLink, LinkIcon, 'Link')}
    </div>
  );
}

export function RichHtmlView({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={cn('prose prose-sm max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
