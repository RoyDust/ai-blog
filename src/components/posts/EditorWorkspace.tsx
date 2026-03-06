"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.success) {
        throw new Error(tokenData.error || "获取上传凭证失败");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", tokenData.data.token);
      formData.append("key", tokenData.data.key);

      const uploadResponse = await fetch(tokenData.data.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("上传到七牛失败");
      }

      const normalizedDomain = String(tokenData.data.domain).replace(/\/$/, "");
      onCoverImageChange(`${normalizedDomain}/${tokenData.data.key}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className="ui-surface rounded-2xl p-6 lg:p-7">
      <h2 className="mb-4 font-display text-xl font-bold text-[var(--foreground)]">编辑器</h2>
      <div className="space-y-4">
        <Input label="标题" placeholder="文章标题" required value={title} onChange={(e) => onTitleChange(e.target.value)} />
        <Input label="Slug" placeholder="url-slug" required value={slug} onChange={(e) => onSlugChange(e.target.value)} />
        <MarkdownEditor label="内容" minRows={36} value={content} onChange={onContentChange} />
        <Input label="摘要" placeholder="文章摘要（可选）" value={excerpt} onChange={(e) => onExcerptChange(e.target.value)} />
        <Input label="封面图 URL" placeholder="https://example.com/cover.jpg" value={coverImage} onChange={(e) => onCoverImageChange(e.target.value)} />
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              id="cover-upload"
              type="file"
              onChange={handleUpload}
            />
            <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
              {isUploading ? "上传中..." : "上传封面到七牛"}
            </Button>
            <p className="text-sm text-[var(--muted)]">支持选择图片后直接上传，并自动回填封面地址。</p>
          </div>
          {uploadError ? <p className="mt-2 text-sm text-rose-500">{uploadError}</p> : null}
        </div>
      </div>
    </section>
  );
}
