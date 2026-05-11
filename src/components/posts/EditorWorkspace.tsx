"use client";

/**
 * 文章编辑工作区。
 *
 * 职责：
 * - 提供标题、slug、正文、摘要、封面图等基础编辑能力
 * - 在 full 模式下额外暴露摘要生成与封面上传功能
 * - 把编辑状态上抛给外层工作台，由外层负责保存与发布
 */

import { useRef, useState } from "react";
import { Button, Input } from "@/components/admin/ui";
import { compressImageForUpload } from "@/lib/client-image-compression";
import { MarkdownEditor } from "./MarkdownEditor";

interface EditorWorkspaceProps {
  mode?: "full" | "content";
  className?: string;
  fillHeight?: boolean;
  contentMinRows?: number;
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
  titleRightSlot?: React.ReactNode;
  slugRightSlot?: React.ReactNode;
}

/**
 * 可复用的文章编辑面板。
 * 既可在完整后台编辑器中使用，也可在只关注正文的轻量场景中复用。
 */
export function EditorWorkspace({
  mode = "full",
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
  titleRightSlot,
  slugRightSlot,
  className = "",
  fillHeight = false,
  contentMinRows,
}: EditorWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [summaryError, setSummaryError] = useState("");

  /**
   * 基于当前标题与正文请求服务端生成摘要。
   * 结果只回填 excerpt，不直接保存数据库。
   */
  const handleGenerateSummary = async () => {
    // 没有正文时不请求摘要接口，避免生成无意义内容。
    if (!content.trim()) return;

    setIsSummarizing(true);
    setSummaryError("");

    try {
      const response = await fetch("/api/admin/posts/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成摘要失败");
      }

      onExcerptChange(String(data.data?.summary ?? ""));
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "生成摘要失败");
    } finally {
      setIsSummarizing(false);
    }
  };

  /**
   * 上传封面图到对象存储，并把最终 URL 回填到表单。
   * 整个流程通过服务端签发上传凭证，避免在客户端暴露存储密钥。
   */
  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const compressed = await compressImageForUpload(file, "cover");
      const uploadFile = compressed.file;
      // 先向服务端申请上传凭证，再直传到对象存储，避免把密钥放到客户端。
      const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: uploadFile.name, contentType: uploadFile.type || file.type }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.success) {
        throw new Error(tokenData.error || "获取上传凭证失败");
      }

      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("token", tokenData.data.token);
      formData.append("key", tokenData.data.key);

      const uploadResponse = await fetch(tokenData.data.uploadUrl, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("上传到七牛失败");
      }

      // domain 配置可能自带尾斜杠，这里统一规整后再回填最终文件地址。
      const normalizedDomain = String(tokenData.data.domain).replace(/\/$/, "");
      onCoverImageChange(`${normalizedDomain}/${tokenData.data.key}`);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        // 清空 input，保证重复选择同一张图时也能再次触发 onChange。
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <section className={`ui-surface rounded-2xl p-5 lg:p-6 ${fillHeight ? "flex min-h-0 flex-col overflow-hidden" : ""} ${className}`}>
      <h2 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">写作画布</h2>
      <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-4" : "space-y-4"}>
        <Input
          label="标题"
          placeholder="文章标题"
          required
          rightSlot={titleRightSlot}
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <Input
          label="Slug"
          placeholder="url-slug"
          required
          rightSlot={slugRightSlot}
          value={slug}
          onChange={(event) => onSlugChange(event.target.value)}
        />
        <MarkdownEditor
          fillHeight={fillHeight}
          label="内容"
          minRows={contentMinRows ?? 36}
          value={content}
          onChange={onContentChange}
        />

        {mode === "full" ? (
          <>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--foreground)]">摘要</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isSummarizing || !content.trim()}
                  onClick={handleGenerateSummary}
                >
                  {isSummarizing ? "生成中..." : "AI 生成摘要"}
                </Button>
              </div>
              <Input placeholder="文章摘要（可选）" value={excerpt} onChange={(event) => onExcerptChange(event.target.value)} />
              <p className="text-sm text-[var(--muted)]">基于当前正文生成适合列表页与 SEO 展示的简短摘要。</p>
              {summaryError ? <p className="text-sm text-rose-500">{summaryError}</p> : null}
            </div>

            <Input
              label="封面图 URL"
              placeholder="https://example.com/cover.jpg"
              value={coverImage}
              onChange={(event) => onCoverImageChange(event.target.value)}
            />

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
          </>
        ) : null}
      </div>
    </section>
  );
}
