"use client";

import { useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading2, Image, Italic, Link2, List, Quote } from "lucide-react";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
}

type Snippet = { before: string; after?: string };

const snippets: Array<{ label: string; icon: typeof Heading2; snippet: Snippet }> = [
  { label: "H2", icon: Heading2, snippet: { before: "## ", after: "" } },
  { label: "Bold", icon: Bold, snippet: { before: "**", after: "**" } },
  { label: "Italic", icon: Italic, snippet: { before: "*", after: "*" } },
  { label: "Quote", icon: Quote, snippet: { before: "> ", after: "" } },
  { label: "Code", icon: Code, snippet: { before: "`", after: "`" } },
  { label: "CodeBlock", icon: Code, snippet: { before: "\n```ts\n", after: "\n```\n" } },
  { label: "Link", icon: Link2, snippet: { before: "[text](", after: ")" } },
  { label: "Image", icon: Image, snippet: { before: "![alt](", after: ")" } },
  { label: "List", icon: List, snippet: { before: "- ", after: "" } },
];

function insertSnippet(value: string, snippet: Snippet) {
  const after = snippet.after ?? "";
  return `${value}${snippet.before}${after}`;
}

export function MarkdownEditor({ label = "内容", value, onChange, minRows = 18 }: MarkdownEditorProps) {
  const id = useId();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-2">
        {snippets.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              title={item.label}
              className="ui-btn rounded-lg border border-transparent px-2 py-1 text-xs text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)]"
              onClick={() => onChange(insertSnippet(value, item.snippet))}
            >
              <span className="inline-flex items-center gap-1">
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            {label}
          </label>
          <textarea
            id={id}
            value={value}
            rows={minRows}
            placeholder="用 Markdown 写作..."
            required
            onChange={(e) => onChange(e.target.value)}
            className="ui-ring min-h-[26rem] w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 font-[var(--font-code)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-[var(--foreground)]">实时预览</p>
          <div className="min-h-[26rem] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-display prose-a:text-[var(--brand)]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value || "_暂无内容_"}</ReactMarkdown>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

