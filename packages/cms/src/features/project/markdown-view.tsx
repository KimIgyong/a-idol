import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ source }: { source: string }) {
  return (
    <div className="prose prose-slate max-w-none text-sm">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="mt-6 mb-3 text-2xl font-bold text-ink-900" {...props} />,
          h2: (props) => <h2 className="mt-5 mb-2 text-xl font-bold text-ink-900" {...props} />,
          h3: (props) => <h3 className="mt-4 mb-2 text-base font-semibold text-ink-900" {...props} />,
          p: (props) => <p className="my-2 leading-relaxed text-ink-700" {...props} />,
          ul: (props) => <ul className="my-2 ml-5 list-disc space-y-1 text-ink-700" {...props} />,
          ol: (props) => <ol className="my-2 ml-5 list-decimal space-y-1 text-ink-700" {...props} />,
          li: (props) => <li {...props} />,
          a: (props) => (
            <a className="text-brand-600 underline hover:text-brand-700" target="_blank" rel="noreferrer" {...props} />
          ),
          code: ({ inline, children, ...rest }: { inline?: boolean; children?: React.ReactNode } & React.HTMLAttributes<HTMLElement>) =>
            inline ? (
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]" {...rest}>
                {children}
              </code>
            ) : (
              <code {...rest}>{children}</code>
            ),
          pre: (props) => (
            <pre
              className="my-3 overflow-x-auto rounded-md bg-slate-900 p-3 font-mono text-[12px] leading-relaxed text-slate-100"
              {...props}
            />
          ),
          table: (props) => (
            <div className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse text-xs" {...props} />
            </div>
          ),
          th: (props) => (
            <th className="border border-slate-200 bg-slate-50 px-2 py-1 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600" {...props} />
          ),
          td: (props) => <td className="border border-slate-200 px-2 py-1 align-top" {...props} />,
          blockquote: (props) => (
            <blockquote className="my-3 border-l-4 border-slate-300 bg-slate-50 px-3 py-2 italic text-slate-600" {...props} />
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
