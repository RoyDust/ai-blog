"use client";

/**
 * 单篇文章 AI 操作工作区。
 *
 * 职责：
 * - 触发摘要、SEO、标题、slug、标签、分类等 AI 动作
 * - 展示 AI 输出预览，并允许应用到当前表单或正式文章
 * - 兼容已落库文章与未保存草稿两种使用场景
 */

import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";
import { getApiErrorMessage } from "@/lib/admin-api-client";

type AppliedPost = {
  id: string;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  seoDescription?: string | null;
  category?: { id: string; name?: string | null; slug?: string | null } | null;
  tags?: Array<{ id: string; name?: string | null; slug?: string | null }>;
};

type DraftPostAiInput = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  seoDescription: string;
  categoryId: string;
  tagIds: string[];
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

/**
 * 从 AI 输出里安全读取字符串数组。
 */
function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/**
 * 将不同 AI 动作的结构化输出转换成预览区可读文本。
 */
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

/**
 * 草稿模式下把 AI 输出映射成外层表单能直接合并的文章片段。
 *
 * 已落库文章不走这里，而是由服务端 apply 接口更新数据库后返回最新文章数据。
 */
function buildDraftAppliedPost(result: AiResult): AppliedPost {
  const output = result.output;
  const applied: AppliedPost = { id: "draft" };

  if (result.action === "summary" && typeof output.summary === "string") {
    applied.excerpt = output.summary;
  } else if (result.action === "seo-description" && typeof output.seoDescription === "string") {
    applied.seoDescription = output.seoDescription;
  } else if (result.action === "title") {
    const title = toStringList(output.titles)[0];
    if (title) applied.title = title;
  } else if (result.action === "slug" && typeof output.slug === "string") {
    applied.slug = output.slug;
  } else if (result.action === "category" && typeof output.categoryId === "string") {
    applied.category = {
      id: output.categoryId,
      name: typeof output.categoryName === "string" ? output.categoryName : null,
      slug: typeof output.categorySlug === "string" ? output.categorySlug : null,
    };
  } else if (result.action === "tags") {
    const tagIds = toStringList(output.existingTagIds);
    if (tagIds.length > 0) {
      applied.tags = tagIds.map((id) => ({ id }));
    }
  }

  return applied;
}

/**
 * 后台文章 AI 工作区主组件。
 * 已有 postId 时结果会通过服务端 apply 落库；草稿模式下则只把结果回填给外层表单。
 */
export function PostAiWorkspace({
  postId,
  draft,
  disabled,
  disabledMessage,
  onApplied,
}: {
  postId?: string;
  draft?: DraftPostAiInput;
  disabled?: boolean;
  disabledMessage?: string;
  onApplied: (post: AppliedPost) => void;
}) {
  const [runningAction, setRunningAction] = useState<PostAiAction | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState("");
  const preview = useMemo(() => renderOutput(result), [result]);

  /**
   * 触发一个 AI 动作，并把返回结果缓存到本地预览区。
   */
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
        body: JSON.stringify(postId ? { postId, action } : { draft, action }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getApiErrorMessage(data, "AI 生成失败"));
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

  /**
   * 应用当前 AI 结果。
   * - 草稿模式：直接回填到外层表单
   * - 正式文章模式：通过服务端接口把 AI 结果落库并刷新文章状态
   */
  async function applyResult() {
    if (!result || applying) {
      return;
    }

    if (!postId) {
      if (result.action === "tags" && toStringList(result.output.existingTagIds).length === 0) {
        const message = "AI 标签建议没有匹配到已有标签";
        setError(message);
        toast.error(message);
        return;
      }

      onApplied(buildDraftAppliedPost(result));
      toast.success("AI 建议已应用到当前表单");
      setResult(null);
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
        throw new Error(getApiErrorMessage(data, "应用 AI 建议失败"));
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
      <p className="text-sm leading-6 text-[var(--muted)]">单项生成只提供建议，确认后再应用到当前表单或文章。</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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

      {disabled ? <p className="text-sm text-[var(--muted)]">{disabledMessage ?? "保存文章正文后再运行 AI 动作。"}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
