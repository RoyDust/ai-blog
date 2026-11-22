"use client";

/**
 * Markdown 编辑器组件。
 *
 * 职责：
 * - 提供文本编辑与实时预览双栏体验（含分屏对照 / 专注写作 / 读者预览切换）
 * - 提供常用 Markdown 片段的光标/选区插入
 * - 支持图片选择上传、粘贴上传与拖拽上传，并发占位替换不覆盖用户输入
 */

import Link from "next/link";
import { memo, useDeferredValue, useEffect, useId, useRef, useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeHighlightCodeLines from "rehype-highlight-code-lines";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading2, Italic, Link2, List, Quote, Upload } from "lucide-react";
import { CodeBlock } from "@/components/blog/CodeBlock";
import { FallbackImage } from "@/components/ui";
import { toErrorMessage } from "@/lib/client-api";
import { compressImageForUpload } from "@/lib/client-image-compression";
import { uploadFileToQiniu } from "@/lib/client-qiniu-upload";
import { classifyMarkdownLink } from "@/lib/markdown-headings";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  fillHeight?: boolean;
  editorPanelClassName?: string;
}

type Snippet = { before: string; after?: string };

const snippets: Array<{ label: string; icon: typeof Heading2; snippet: Snippet }> = [
  { label: "二级标题", icon: Heading2, snippet: { before: "## ", after: "" } },
  { label: "加粗", icon: Bold, snippet: { before: "**", after: "**" } },
  { label: "斜体", icon: Italic, snippet: { before: "*", after: "*" } },
  { label: "引用", icon: Quote, snippet: { before: "> ", after: "" } },
  { label: "行内代码", icon: Code, snippet: { before: "`", after: "`" } },
  { label: "代码块", icon: Code, snippet: { before: "\n```ts\n", after: "\n```\n" } },
  { label: "链接", icon: Link2, snippet: { before: "[text](", after: ")" } },
  { label: "列表", icon: List, snippet: { before: "- ", after: "" } },
];

const previewProseClassName =
  "reader-prose prose prose-zinc max-w-none prose-headings:font-display prose-headings:text-[var(--foreground)] prose-h1:text-[var(--foreground)] prose-h2:text-[var(--foreground)] [&_h2]:before:mr-1.5 [&_h2]:before:font-mono [&_h2]:before:text-[var(--brand)] [&_h2]:before:content-['#'] prose-h3:text-[var(--foreground)] prose-h4:text-[var(--foreground)] prose-h5:text-[var(--foreground)] prose-h6:text-[var(--foreground)] prose-p:leading-[1.76] prose-p:text-[var(--text-body)] prose-a:text-[var(--brand)] prose-a:no-underline hover:prose-a:underline prose-strong:text-[var(--foreground)] prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-faint)] prose-blockquote:border-[var(--border-strong)] prose-blockquote:border-l-[3px] prose-blockquote:text-[var(--text-body)] prose-img:rounded-xl prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[var(--surface-elevated)] prose-pre:text-[var(--foreground)] prose-code:rounded-md prose-code:border prose-code:border-[var(--line-color)] prose-code:bg-[var(--btn-regular-bg)] prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.875em] prose-code:font-medium prose-code:text-[var(--btn-content)] prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--surface-contrast)] prose-th:text-[var(--foreground)] prose-td:border-[var(--border)] prose-th:border-[var(--border)] dark:prose-invert";

const previewRemarkPlugins = [remarkGfm];
const previewRehypePlugins = [rehypeHighlight, [rehypeHighlightCodeLines, { showLineNumbers: true }]] as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"];

function sanitizeAnchorProps<T extends { node?: unknown; href?: unknown; target?: unknown; rel?: unknown }>(
  props: T,
): Omit<T, "node" | "href" | "target" | "rel"> {
  const rest = { ...props };
  delete rest.node;
  delete rest.href;
  delete rest.target;
  delete rest.rel;
  return rest;
}

const previewComponents: Components = {
  a: ({ href, children, ...props }) => {
    const anchorProps = sanitizeAnchorProps(props);
    const classified = classifyMarkdownLink(typeof href === "string" ? href : undefined);

    if (classified.kind === "unsafe") {
      return (
        <span className={anchorProps.className} title={anchorProps.title}>
          {children}
        </span>
      );
    }

    if (classified.kind === "internal") {
      return (
        <Link {...anchorProps} href={classified.href}>
          {children}
        </Link>
      );
    }

    if (classified.kind === "external") {
      return (
        <a {...anchorProps} href={classified.href} rel={classified.rel} target={classified.target}>
          {children}
        </a>
      );
    }

    return (
      <a {...anchorProps} href={classified.href}>
        {children}
      </a>
    );
  },
  img: ({ src, alt }) => {
    const imageSrc = typeof src === "string" ? src : null;
    if (!imageSrc) return null;
    if (imageSrc.startsWith("uploading://")) {
      return <span className="font-mono text-xs text-[var(--text-muted)]">{alt || "上传中..."}</span>;
    }

    return <FallbackImage alt={alt ?? ""} className="theme-media-image h-auto w-full" height={720} src={imageSrc} unoptimized width={1280} />;
  },
  pre: ({ children, ...props }) => <CodeBlock {...props}>{children}</CodeBlock>,
};

const MarkdownPreviewArticle = memo(function MarkdownPreviewArticle({ content }: { content: string }) {
  return (
    <article className={previewProseClassName}>
      <ReactMarkdown
        remarkPlugins={previewRemarkPlugins}
        rehypePlugins={previewRehypePlugins}
        components={previewComponents}
      >
        {content || "_暂无内容_"}
      </ReactMarkdown>
    </article>
  );
});

function insertSnippetAt(value: string, snippet: Snippet, selectionStart: number, selectionEnd: number) {
  const after = snippet.after ?? "";
  const selected = value.slice(selectionStart, selectionEnd);
  const nextValue = `${value.slice(0, selectionStart)}${snippet.before}${selected}${after}${value.slice(selectionEnd)}`;
  const caretStart = selectionStart + snippet.before.length;
  const caretEnd = caretStart + selected.length;

  return { value: nextValue, caretStart, caretEnd };
}

function getImageAltText(filename: string) {
  const baseName = filename.replace(/\.[^.]+$/, "").trim();
  const normalized = baseName
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "image";
}

function insertMarkdownToken(
  value: string,
  markdown: string,
  selectionStart?: number,
  selectionEnd?: number,
) {
  if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    return {
      value: `${before}${markdown}${after}`,
      caretPosition: before.length + markdown.length,
    };
  }

  const separator = value.trim().length > 0 ? "\n\n" : "";
  const nextValue = `${value}${separator}${markdown}`;
  return {
    value: nextValue,
    caretPosition: nextValue.length,
  };
}

function resolveUploadPlaceholder(content: string, placeholder: string, finalMarkdown: string) {
  if (content.includes(placeholder)) {
    return content.replace(placeholder, finalMarkdown);
  }

  if (content.trim().length === 0) {
    return finalMarkdown;
  }

  const separator = content.endsWith("\n\n") ? "" : content.endsWith("\n") ? "\n" : "\n\n";
  return `${content}${separator}${finalMarkdown}`;
}

function removeUploadPlaceholder(content: string, placeholder: string) {
  if (!content.includes(placeholder)) {
    return content;
  }

  if (content.includes(`\n\n${placeholder}\n\n`)) {
    return content.replace(`\n\n${placeholder}\n\n`, "\n\n");
  }

  if (content.endsWith(`\n\n${placeholder}`)) {
    return content.slice(0, -`\n\n${placeholder}`.length);
  }

  if (content.startsWith(`${placeholder}\n\n`)) {
    return content.slice(`${placeholder}\n\n`.length);
  }

  return content.replace(placeholder, "");
}

function getClipboardImageFile(event: React.ClipboardEvent<HTMLTextAreaElement>) {
  const items = Array.from(event.clipboardData?.items ?? []);

  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }

  return null;
}

export function MarkdownEditor({
  label = "内容",
  value,
  onChange,
  minRows = 18,
  fillHeight = false,
  editorPanelClassName,
}: MarkdownEditorProps) {
  const id = useId();
  const deferredValue = useDeferredValue(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const latestValueRef = useRef(value);
  const uploadSequenceRef = useRef(0);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [viewMode, setViewMode] = useState<"split" | "write" | "preview">("split");
  const isUploading = uploadingCount > 0;
  const charCount = value.trim().length;

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const emitChange = (nextValue: string) => {
    latestValueRef.current = nextValue;
    onChange(nextValue);
  };

  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const applySnippet = (snippet: Snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { value: nextValue, caretStart, caretEnd } = insertSnippetAt(latestValueRef.current, snippet, start, end);

    emitChange(nextValue);

    requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      if (start !== end) {
        nextTextarea.setSelectionRange(caretStart, caretEnd);
      } else {
        nextTextarea.setSelectionRange(caretStart, caretStart);
      }
    });
  };

  const uploadImageFile = async (file: File) => {
    const compressed = await compressImageForUpload(file, "markdown");
    const uploadFile = compressed.file;
    const { url } = await uploadFileToQiniu(uploadFile, {
      contentType: uploadFile.type || file.type,
    });

    return {
      url,
      altText: getImageAltText(file.name),
    };
  };

  const runImageUploadWithPlaceholder = async (file: File, restoreCaret: boolean) => {
    uploadSequenceRef.current += 1;
    const uploadId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${uploadSequenceRef.current}`;
    const placeholder = `![上传中...](uploading://${uploadId})`;
    const storedSelection = selectionRef.current;
    const { value: withPlaceholder, caretPosition } = insertMarkdownToken(
      latestValueRef.current,
      placeholder,
      storedSelection?.start,
      storedSelection?.end,
    );

    selectionRef.current = { start: caretPosition, end: caretPosition };
    setUploadingCount((count) => count + 1);
    setUploadError("");
    emitChange(withPlaceholder);

    if (restoreCaret) {
      requestAnimationFrame(() => {
        const nextTextarea = textareaRef.current;
        if (!nextTextarea) return;
        nextTextarea.setSelectionRange(caretPosition, caretPosition);
      });
    }

    try {
      const { url, altText } = await uploadImageFile(file);
      const finalMarkdown = `![${altText}](${url})`;
      emitChange(resolveUploadPlaceholder(latestValueRef.current, placeholder, finalMarkdown));
    } catch (error) {
      emitChange(removeUploadPlaceholder(latestValueRef.current, placeholder));
      setUploadError(toErrorMessage(error, "上传失败"));
    } finally {
      setUploadingCount((count) => Math.max(0, count - 1));
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await runImageUploadWithPlaceholder(file, false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = getClipboardImageFile(event);
    if (!file) return;

    event.preventDefault();
    syncSelection();
    await runImageUploadWithPlaceholder(file, true);
  };

  const handleDrop = async (event: React.DragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(event.dataTransfer?.files ?? []).find((item) => item.type.startsWith("image/"));
    if (!file) return;

    event.preventDefault();
    syncSelection();
    await runImageUploadWithPlaceholder(file, false);
  };

  const panelSizeClassName = fillHeight ? "min-h-0 flex-1 max-h-none" : editorPanelClassName ?? "min-h-[26rem] max-h-[700px]";
  const columnClassName = fillHeight ? "flex min-h-0 flex-col" : "";
  const gridModeClassName = viewMode === "split" ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1";

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2.5" : "space-y-2.5"}>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--surface-alt)]/75 px-2.5 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {snippets.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                title={item.label}
                className="ui-btn shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                onClick={() => applySnippet(item.snippet)}
              >
                <span className="inline-flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </span>
              </button>
            );
          })}

          <input ref={fileInputRef} accept="image/*" className="hidden" type="file" onChange={handleImageUpload} />
          <button
            type="button"
            className="ui-btn shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              syncSelection();
              fileInputRef.current?.click();
            }}
            disabled={isUploading}
          >
            <span className="inline-flex items-center gap-1">
              <Upload className="h-3.5 w-3.5" />
              {isUploading ? "上传中..." : "上传图片"}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden font-mono text-[11px] tabular-nums text-[var(--muted)] sm:inline">
            {charCount.toLocaleString("zh-CN")} 字
          </span>
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--surface)]/80 p-0.5" role="group" aria-label="编辑器视图切换">
            {(
              [
                { id: "split", label: "分屏对照" },
                { id: "write", label: "专注写作" },
                { id: "preview", label: "读者预览" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={viewMode === item.id}
                onClick={() => setViewMode(item.id)}
                className={`h-6 shrink-0 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold transition-colors ${
                  viewMode === item.id
                    ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {uploadError ? (
        <p role="alert" className="text-sm text-[var(--danger-foreground)]">
          {uploadError}
        </p>
      ) : null}

      <div className={fillHeight ? `grid min-h-0 flex-1 gap-3.5 ${gridModeClassName}` : `grid gap-3.5 ${gridModeClassName}`}>
        <div className={`${columnClassName} ${viewMode === "preview" ? "hidden" : ""}`}>
          <label htmlFor={id} className="mb-1 block text-xs font-semibold text-[var(--muted)]">
            {label}
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            rows={minRows}
            placeholder="用 Markdown 写作，支持粘贴或拖拽上传图片..."
            required
            onChange={(e) => emitChange(e.target.value)}
            onClick={syncSelection}
            onDragOver={(e) => {
              if (Array.from(e.dataTransfer?.types ?? []).includes("Files")) {
                e.preventDefault();
              }
            }}
            onDrop={handleDrop}
            onKeyUp={syncSelection}
            onPaste={handlePaste}
            onSelect={syncSelection}
            className={`ui-ring ${panelSizeClassName} w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/45 p-4 font-[var(--font-code)] text-[13px] leading-[1.72] text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]`}
          />
        </div>

        <div className={`${columnClassName} ${viewMode === "write" ? "hidden" : ""}`}>
          <p className="mb-1 block text-xs font-semibold text-[var(--muted)]">实时预览</p>
          <div className={`${panelSizeClassName} overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]/45 p-4`}>
            <MarkdownPreviewArticle content={deferredValue} />
          </div>
        </div>
      </div>
    </div>
  );
}
