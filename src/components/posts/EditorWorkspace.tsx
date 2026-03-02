"use client";

import { Input } from "@/components/ui";

interface EditorWorkspaceProps {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  onTitleChange: (value: string) => void;
  onSlugChange: (value: string) => void;
  onContentChange: (value: string) => void;
  onExcerptChange: (value: string) => void;
  onCoverImageChange: (value: string) => void;
}

export function EditorWorkspace({
  title,
  slug,
  content,
  excerpt,
  coverImage,
  onTitleChange,
  onSlugChange,
  onContentChange,
  onExcerptChange,
  onCoverImageChange,
}: EditorWorkspaceProps) {
  return (
    <section className="ui-surface rounded-2xl p-6">
      <h2 className="mb-4 font-display text-xl font-bold text-[var(--foreground)]">编辑器</h2>
      <div className="space-y-4">
        <Input label="标题" placeholder="文章标题" required value={title} onChange={(e) => onTitleChange(e.target.value)} />
        <Input label="Slug" placeholder="url-slug" required value={slug} onChange={(e) => onSlugChange(e.target.value)} />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">内容</label>
          <textarea
            className="ui-ring min-h-80 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            placeholder="用 Markdown 写作..."
            required
            rows={18}
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
          />
        </div>
        <Input label="摘要" placeholder="文章摘要（可选）" value={excerpt} onChange={(e) => onExcerptChange(e.target.value)} />
        <Input
          label="封面图 URL"
          placeholder="https://example.com/cover.jpg"
          value={coverImage}
          onChange={(e) => onCoverImageChange(e.target.value)}
        />
      </div>
    </section>
  );
}
