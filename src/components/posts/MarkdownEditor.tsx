"use client";

/**
 * Markdown 编辑器组件。
 *
 * 职责：
 * - 提供文本编辑与实时预览双栏体验
 * - 提供常用 Markdown 片段的光标/选区插入
 * - 支持图片选择上传与粘贴上传，并自动写回 Markdown 图片语法
 */

import { useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FieldLabel, InlineSpinner } from "@/components/admin/workspace/WorkspaceKit";
import { editorialEase } from "@/components/editorial";
import { FallbackImage } from "@/components/ui";
import { cn } from "@/lib/cn";
import { compressImageForUpload } from "@/lib/client-image-compression";

interface MarkdownEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  minRows?: number;
  fillHeight?: boolean;
  editorPanelClassName?: string;
}

type Snippet = { before: string; after?: string };

/**
 * 工具栏按钮（方向 A）：去掉图标只留文字，按「标题 / 强调」「引用 / 代码」「链接 / 列表」三组，组间 1px 竖线。
 */
const snippetGroups: Array<Array<{ label: string; snippet: Snippet }>> = [
  [
    { label: "二级标题", snippet: { before: "## ", after: "" } },
    { label: "加粗", snippet: { before: "**", after: "**" } },
    { label: "斜体", snippet: { before: "*", after: "*" } },
  ],
  [
    { label: "引用", snippet: { before: "> ", after: "" } },
    { label: "行内代码", snippet: { before: "`", after: "`" } },
    { label: "代码块", snippet: { before: "\n```ts\n", after: "\n```\n" } },
  ],
  [
    { label: "链接", snippet: { before: "[text](", after: ")" } },
    { label: "列表", snippet: { before: "- ", after: "" } },
  ],
];

const toolbarButtonClassName =
  "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[2px] px-[7px] text-[0.8125rem] font-bold whitespace-nowrap text-[var(--text-body)] transition-colors duration-150 hover:bg-[var(--ed-press-bg)] hover:text-[var(--foreground)] active:bg-[color-mix(in_oklab,var(--foreground)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent";

const previewProseClassName =
  "prose prose-zinc max-w-none text-sm leading-[1.8] prose-headings:font-serif prose-headings:font-bold prose-headings:text-[var(--foreground)] prose-h1:text-xl prose-h2:mt-[18px] prose-h2:mb-2 prose-h2:text-[1.0625rem] prose-h3:text-base prose-h1:text-[var(--foreground)] prose-h2:text-[var(--foreground)] prose-h3:text-[var(--foreground)] prose-h4:text-[var(--foreground)] prose-h5:text-[var(--foreground)] prose-h6:text-[var(--foreground)] prose-p:my-2.5 prose-p:text-[var(--text-body)] prose-a:text-[var(--ed-link)] prose-a:underline prose-a:decoration-[var(--reader-border-strong)] prose-a:underline-offset-4 hover:prose-a:decoration-[var(--accent-sky)] prose-strong:text-[var(--foreground)] prose-li:my-0.5 prose-li:text-[var(--text-body)] prose-li:marker:text-[var(--text-muted)] prose-blockquote:border-l-2 prose-blockquote:border-[var(--reader-border-strong)] prose-blockquote:pl-3.5 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-[var(--text-body)] prose-img:rounded-[4px] prose-pre:rounded-[4px] prose-pre:border-0 prose-pre:bg-[var(--surface-elevated)] prose-pre:px-3 prose-pre:py-2.5 prose-pre:text-xs prose-pre:leading-[1.7] prose-pre:text-[var(--foreground)] prose-code:rounded-[2px] prose-code:bg-[var(--ed-press-bg)] prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.8125rem] prose-code:font-normal prose-code:text-[var(--foreground)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:text-[var(--foreground)] prose-td:border-[var(--border)] prose-th:border-[var(--reader-border-strong)] dark:prose-invert";

/**
 * 在指定选区位置插入预设 Markdown 片段：
 * - 有选区：用成对标记（before/after）包裹选中文本
 * - 无选区：在光标处插入标记，并把光标放到成对标记中间
 * 返回插入后的完整内容与应恢复的光标/选区位置。
 */
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

/**
 * 把上传后的图片地址插入为 Markdown 图片语法。
 * 若存在选区，则替换选区；否则按段落形式追加到文末。
 */
function insertImageMarkdown(
  value: string,
  imageUrl: string,
  altText: string,
  selectionStart?: number,
  selectionEnd?: number
) {
  const markdown = `![${altText}](${imageUrl})`;

  if (typeof selectionStart === "number" && typeof selectionEnd === "number") {
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    return `${before}${markdown}${after}`;
  }

  const separator = value.trim().length > 0 ? "\n\n" : "";
  return `${value}${separator}${markdown}`;
}

/**
 * 从粘贴事件中提取第一张图片文件，用于支持截图直接粘贴上传。
 */
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

/**
 * Markdown 编辑器主组件。
 *
 * 说明：
 * - 通过 selectionRef 记住插图时的光标位置
 * - 上传图片后会把结果回填为 Markdown，而不是维护独立富媒体结构
 */
export function MarkdownEditor({
  label = "内容",
  value,
  onChange,
  minRows = 18,
  fillHeight = false,
  editorPanelClassName,
}: MarkdownEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  /**
   * 同步当前 textarea 选区，供插入图片或其他增强操作复用。
   */
  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  /**
   * 在光标处/选区位置插入格式标记：
   * 读取 textarea 的 selectionStart/End，选中文本则用成对标记包裹，
   * 无选区则在光标处插入并把光标置于标记中间；onChange 提交后聚焦 textarea 并恢复选区。
   */
  const applySnippet = (snippet: Snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const { value: nextValue, caretStart, caretEnd } = insertSnippetAt(value, snippet, start, end);

    onChange(nextValue);

    requestAnimationFrame(() => {
      const nextTextarea = textareaRef.current;
      if (!nextTextarea) return;

      nextTextarea.focus();
      if (start !== end) {
        // 选中文本被包裹后，仍保持原文本处于选中状态
        nextTextarea.setSelectionRange(caretStart, caretEnd);
      } else {
        // 无选区：光标置于成对标记中间
        nextTextarea.setSelectionRange(caretStart, caretStart);
      }
    });
  };

  /**
   * 向服务端申请上传凭证并完成图片直传。
   * 返回最终可写入 Markdown 的图片 URL 与默认 alt 文本。
   */
  const uploadImageFile = async (file: File) => {
    const compressed = await compressImageForUpload(file, "markdown");
    const uploadFile = compressed.file;
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

    const normalizedDomain = String(tokenData.data.domain).replace(/\/$/, "");
    return {
      url: `${normalizedDomain}/${tokenData.data.key}`,
      altText: getImageAltText(file.name),
    };
  };

  /**
   * 处理用户通过文件选择器上传图片的流程。
   */
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError("");

    try {
      const { url, altText } = await uploadImageFile(file);
      const storedSelection = selectionRef.current;

      onChange(insertImageMarkdown(value, url, altText, storedSelection?.start, storedSelection?.end));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  /**
   * 处理截图粘贴上传场景。
   * 如果剪贴板里没有图片，则保持浏览器默认粘贴行为。
   */
  const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = getClipboardImageFile(event);
    if (!file) return;

    event.preventDefault();
    syncSelection();
    setIsUploading(true);
    setUploadError("");

    try {
      const { url, altText } = await uploadImageFile(file);
      const storedSelection = selectionRef.current;

      onChange(insertImageMarkdown(value, url, altText, storedSelection?.start, storedSelection?.end));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const reduceMotion = useReducedMotion();
  const panelSizeClassName = fillHeight ? "min-h-0 flex-1" : editorPanelClassName ?? "min-h-[26rem] max-h-[700px]";
  const uploadErrorId = `${id}-upload-error`;

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : "flex flex-col"} data-slot="markdown-editor">
      <div className="mb-1.5">
        <FieldLabel htmlFor={id} required>
          {label}
        </FieldLabel>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] transition-[border-color] duration-150 has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-[var(--focus)]",
          fillHeight && "min-h-0 flex-1",
        )}
        data-slot="markdown-frame"
      >
        <div
          role="toolbar"
          aria-label="Markdown 格式"
          className="flex h-10 shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--border)] px-1.5"
        >
          {snippetGroups.map((group, groupIndex) => (
            <span key={group[0].label} className="flex shrink-0 items-center gap-0.5">
              {groupIndex > 0 ? <span aria-hidden="true" className="mx-1.5 h-4 w-px shrink-0 bg-[var(--border)]" /> : null}
              {group.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  title={item.label}
                  className={toolbarButtonClassName}
                  onClick={() => applySnippet(item.snippet)}
                >
                  {item.label}
                </button>
              ))}
            </span>
          ))}

          <input ref={fileInputRef} accept="image/*" className="hidden" type="file" onChange={handleImageUpload} />
          <button
            type="button"
            aria-busy={isUploading || undefined}
            aria-describedby={uploadError ? uploadErrorId : undefined}
            className={cn(toolbarButtonClassName, "ml-auto")}
            onClick={() => {
              syncSelection();
              fileInputRef.current?.click();
            }}
            disabled={isUploading}
          >
            {isUploading ? <InlineSpinner /> : null}
            {isUploading ? "上传中..." : "上传图片"}
          </button>
        </div>

        <div className={cn("grid grid-cols-1 xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]", fillHeight && "min-h-0 flex-1")}>
          <div className="flex min-h-0 min-w-0 flex-col">
            <div aria-hidden="true" className="shrink-0 px-4 pt-2 text-[0.6875rem] font-bold tracking-[0.08em] text-[var(--text-muted)]">
              Markdown
            </div>
            <textarea
              ref={textareaRef}
              id={id}
              value={value}
              rows={minRows}
              placeholder="用 Markdown 写作..."
              required
              aria-required="true"
              onChange={(e) => onChange(e.target.value)}
              onClick={syncSelection}
              onKeyUp={syncSelection}
              onPaste={handlePaste}
              onSelect={syncSelection}
              className={cn(
                panelSizeClassName,
                "block w-full resize-none overflow-y-auto border-0 bg-transparent px-4 pt-1.5 pb-4 font-mono text-[0.8125rem] leading-[1.75] text-[var(--foreground)] [scrollbar-color:var(--reader-border-strong)_transparent] [scrollbar-width:thin] outline-none placeholder:text-[var(--text-muted)] focus-visible:outline-none",
              )}
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-col border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_2%,transparent)] xl:border-t-0 xl:border-l">
            <p className="shrink-0 px-4 pt-2 text-[0.6875rem] font-bold tracking-[0.08em] text-[var(--text-muted)]">实时预览</p>
            <div
              className={cn(
                panelSizeClassName,
                "overflow-y-auto px-[18px] pt-1.5 pb-4 [scrollbar-color:var(--reader-border-strong)_transparent] [scrollbar-width:thin]",
              )}
            >
              <article className={previewProseClassName}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeHighlight]}
                  components={{
                    img: ({ src, alt }) => {
                      const imageSrc = typeof src === "string" ? src : null;
                      if (!imageSrc) return null;

                      return <FallbackImage alt={alt ?? ""} className="theme-media-image h-auto w-full" height={720} src={imageSrc} unoptimized width={1280} />;
                    },
                  }}
                >
                  {value || "_暂无内容_"}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {uploadError ? (
          <motion.p
            key="upload-error"
            id={uploadErrorId}
            role="alert"
            className="mt-1.5 shrink-0 text-[0.8125rem] text-[var(--danger-foreground)]"
            initial={reduceMotion ? false : { opacity: 0, y: -2 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: editorialEase } }}
            exit={{ opacity: 0, transition: { duration: reduceMotion ? 0 : 0.14 } }}
          >
            {uploadError}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
