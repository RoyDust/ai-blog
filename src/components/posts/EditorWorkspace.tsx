"use client";

import { Input } from "@/components/ui";
import { MarkdownEditor } from "./MarkdownEditor";

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
    <section className="ui-surface rounded-2xl p-6 lg:p-7">
      <h2 className="mb-4 font-display text-xl font-bold text-[var(--foreground)]">编辑器</h2>
      <div className="space-y-4">
        <Input label="标题" placeholder="文章标题" required value={title} onChange={(e) => onTitleChange(e.target.value)} />
        <Input label="Slug" placeholder="url-slug" required value={slug} onChange={(e) => onSlugChange(e.target.value)} />
        <MarkdownEditor label="内容" minRows={36} value={content} onChange={onContentChange} />
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
