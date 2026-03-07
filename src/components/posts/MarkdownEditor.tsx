"use client";

import NextImage from "next/image";
import { useId, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bold, Code, Heading2, Italic, Link2, List, Quote, Upload } from "lucide-react";

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
  { label: "List", icon: List, snippet: { before: "- ", after: "" } },
];

function insertSnippet(value: string, snippet: Snippet) {
  const after = snippet.after ?? "";
  return `${value}${snippet.before}${after}`;
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

export function MarkdownEditor({ label = "内容", value, onChange, minRows = 18 }: MarkdownEditorProps) {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const syncSelection = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    selectionRef.current = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    };
  };

  const uploadImageFile = async (file: File) => {
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
    return {
      url: `${normalizedDomain}/${tokenData.data.key}`,
      altText: getImageAltText(file.name),
    };
  };

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

        <input ref={fileInputRef} accept="image/*" className="hidden" type="file" onChange={handleImageUpload} />
        <button
          type="button"
          className="ui-btn rounded-lg border border-transparent px-2 py-1 text-xs text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            syncSelection();
            fileInputRef.current?.click();
          }}
          disabled={isUploading}
        >
          <span className="inline-flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" />
            {isUploading ? "上传中..." : "上传图片到七牛"}
          </span>
        </button>
      </div>

      {uploadError ? <p className="text-sm text-rose-500">{uploadError}</p> : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-medium text-[var(--foreground)]">
            {label}
          </label>
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            rows={minRows}
            placeholder="用 Markdown 写作..."
            required
            onChange={(e) => onChange(e.target.value)}
            onClick={syncSelection}
            onKeyUp={syncSelection}
            onPaste={handlePaste}
            onSelect={syncSelection}
            className="ui-ring min-h-[26rem] max-h-[700px] w-full overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 font-[var(--font-code)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          />
        </div>

        <div>
          <p className="mb-1 block text-sm font-medium text-[var(--foreground)]">实时预览</p>
          <div className="min-h-[26rem] max-h-[700px] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <article className="prose prose-zinc dark:prose-invert prose-headings:font-display prose-a:text-[var(--primary)] prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-pre:rounded-xl prose-pre:border prose-pre:border-[var(--border)] prose-pre:bg-[#0b1220] prose-pre:text-slate-100 prose-code:font-[var(--font-code)] prose-code:before:content-none prose-code:after:content-none prose-table:w-full prose-th:bg-[var(--surface-alt)] max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  img: ({ src, alt }) => {
                    const imageSrc = typeof src === "string" ? src : null;
                    if (!imageSrc) return null;

                    return <NextImage alt={alt ?? ""} className="h-auto w-full" height={720} src={imageSrc} unoptimized width={1280} />;
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
  );
}
