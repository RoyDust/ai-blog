"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui";

type AppliedPost = {
  id: string;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  seoDescription?: string | null;
  category?: { id: string; name?: string | null; slug?: string | null } | null;
  tags?: Array<{ id: string; name?: string | null; slug?: string | null }>;
};

type AiResult = {
  taskId: string;
  itemId: string;
  action: PostAiAction;
  modelId: string;
  output: Record<string, unknown>;
};

type PostAiAction = "summary" | "seo-description" | "title" | "slug" | "tags" | "category";

const actions: Array<{ action: PostAiAction; label: string; hint: string }> = [
  { action: "summary", label: "生成摘要", hint: "更新列表摘要" },
  { action: "seo-description", label: "生成 SEO 描述", hint: "补齐搜索结果描述" },
  { action: "title", label: "建议标题", hint: "给出 3 个候选" },
  { action: "slug", label: "建议 Slug", hint: "生成 URL 友好路径" },
  { action: "tags", label: "建议标签", hint: "匹配已有标签" },
  { action: "category", label: "建议分类", hint: "从已有分类中选择" },
];

const actionLabels: Record<PostAiAction, string> = {
  summary: "摘要",
  "seo-description": "SEO 描述",
  title: "标题",
  slug: "Slug",
  tags: "标签",
  category: "分类",
};

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function renderOutput(result: AiResult | null) {
  if (!result) {
    return "选择一个 AI 动作后，结果会显示在这里。";
  }

  const output = result.output;

  if (result.action === "summary" && typeof output.summary === "string") {
    return output.summary;
  }

  if (result.action === "seo-description" && typeof output.seoDescription === "string") {
    return output.seoDescription;
  }

  if (result.action === "title") {
    return toStringList(output.titles).join("\n");
  }

  if (result.action === "slug" && typeof output.slug === "string") {
    return output.slug;
  }

  if (result.action === "tags") {
    return toStringList(output.names).join("、") || toStringList(output.newTagNames).join("、") || "未返回标签";
  }

  if (result.action === "category") {
    return [output.categoryName, output.reason].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join("\n");
  }

  return JSON.stringify(output, null, 2);
}

export function PostAiWorkspace({
  postId,
  disabled,
  onApplied,
}: {
  postId: string;
  disabled?: boolean;
  onApplied: (post: AppliedPost) => void;
}) {
  const [runningAction, setRunningAction] = useState<PostAiAction | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const preview = useMemo(() => renderOutput(result), [result]);

  async function runAction(action: PostAiAction) {
    if (runningAction || disabled) {
      return;
    }

    setRunningAction(action);
    setError("");

    try {
      const response = await fetch("/api/admin/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "AI 生成失败"));
      }

      setResult({
        taskId: String(data.data.taskId),
        itemId: String(data.data.itemId),
        action: data.data.action as PostAiAction,
        modelId: String(data.data.modelId ?? "默认模型"),
        output: data.data.output && typeof data.data.output === "object" ? data.data.output : {},
      });
      toast.success(`${actionLabels[action]}建议已生成`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 生成失败";
      setError(message);
      toast.error(message);
    } finally {
      setRunningAction(null);
    }
  }

  async function applyResult() {
    if (!result || applying) {
      return;
    }

    setApplying(true);
    setError("");

    try {
      const response = await fetch("/api/admin/ai/actions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: result.itemId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "应用 AI 建议失败"));
      }

      onApplied(data.data as AppliedPost);
      toast.success("AI 建议已应用到当前表单");
      setResult(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "应用 AI 建议失败";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {actions.map((item) => (
          <button
            key={item.action}
            type="button"
            disabled={disabled || Boolean(runningAction)}
            className="ui-ring rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            onClick={() => void runAction(item.action)}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--foreground)]">{item.label}</span>
              {runningAction === item.action ? <StatusBadge tone="warning">生成中</StatusBadge> : null}
            </span>
            <span className="mt-1 block text-xs text-[var(--muted)]">{item.hint}</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--foreground)]">{result ? `${actionLabels[result.action]}预览` : "结果预览"}</p>
          {result ? (
            <a className="text-xs text-[var(--brand)] hover:underline" href={`/admin/ai/tasks/${result.taskId}`}>
              查看任务
            </a>
          ) : null}
        </div>
        <pre className="mt-3 max-h-56 whitespace-pre-wrap break-words rounded-xl bg-[var(--surface)] p-3 text-sm leading-6 text-[var(--foreground)]">
          {preview || "AI 未返回可展示内容"}
        </pre>
        {result ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" disabled={applying} onClick={() => void applyResult()}>
              {applying ? "应用中..." : "应用建议"}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={applying} onClick={() => setResult(null)}>
              忽略
            </Button>
            <span className="text-xs text-[var(--muted)]">模型：{result.modelId}</span>
          </div>
        ) : null}
      </div>

      {disabled ? <p className="text-sm text-[var(--muted)]">保存文章正文后再运行 AI 动作。</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
