"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { Button } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { cn } from "@/lib/cn";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type TaskItem = {
  id: string;
  postId: string | null;
  action: string;
  status: string;
  output: unknown;
  applied: boolean;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    seoDescription: string | null;
  } | null;
};

type TaskDetail = {
  id: string;
  type: string;
  status: string;
  source: string;
  modelId: string | null;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  metadata: unknown;
  items: TaskItem[];
  createdBy?: { name: string | null; email: string } | null;
};

type ArticleInfoSummary = {
  slug: string;
  excerpt: string;
  seoDescription: string;
  categoryName: string;
  tagNames: string[];
  partial: boolean;
  quality: Record<string, unknown>;
};

const taskTypeLabels: Record<string, string> = {
  "post-summary": "文章摘要",
  "post-article-info": "文章信息",
  "post-seo-description": "SEO 描述",
  "post-title-suggestion": "标题建议",
  "post-slug-suggestion": "Slug 建议",
  "post-tag-suggestion": "标签建议",
  "post-category-suggestion": "分类建议",
  "post-cover-image": "封面生图",
  "post-bulk-completion": "批量补全",
};

const actionLabels: Record<string, string> = {
  summary: "摘要",
  "seo-description": "SEO 描述",
  title: "标题",
  slug: "Slug",
  tags: "标签",
  category: "分类",
  "cover-image": "封面",
};

const statusLabels: Record<string, string> = {
  QUEUED: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "已完成",
  PARTIAL_FAILED: "部分失败",
  FAILED: "失败",
  SKIPPED: "已跳过",
};

/**
 * 将任务和任务项状态映射到语气色文字（方向 A：状态是 .75rem 700 语气色文字，不是药丸）。
 */
function statusToneClassName(status: string) {
  if (status === "SUCCEEDED") return "text-[var(--success)]";
  if (status === "FAILED" || status === "PARTIAL_FAILED") return "text-[var(--danger-foreground)]";
  if (status === "RUNNING" || status === "QUEUED") return "text-[var(--focus)]";
  return "text-[var(--text-muted)]";
}

function StatusText({ status }: { status: string }) {
  return <span className={cn("text-xs font-bold whitespace-nowrap", statusToneClassName(status))}>{statusLabels[status] ?? status}</span>;
}

/**
 * 任务详情页使用的紧凑时间格式。
 */
function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 根据任务开始/结束时间计算耗时；运行中的任务按当前时间估算。
 */
function formatDuration(task: TaskDetail) {
  if (!task.startedAt) return "-";
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  const duration = Math.max(0, Math.round((end - new Date(task.startedAt).getTime()) / 1000));

  if (duration < 60) return `${duration}s`;
  return `${Math.floor(duration / 60)}m ${duration % 60}s`;
}

/**
 * 将未知 AI 输出收敛成普通对象，方便后续按动作读取字段。
 */
function readOutput(output: unknown) {
  return output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>) : {};
}

function readMetadata(metadata: unknown) {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value : "";
}

/**
 * 从 AI 输出里安全读取字符串数组。
 */
function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/**
 * 把任务项输出转换成表格中适合扫描的短预览。
 */
function renderOutput(item: TaskItem) {
  const output = readOutput(item.output);

  if (item.action === "summary" && typeof output.summary === "string") {
    return output.summary;
  }

  if (item.action === "seo-description" && typeof output.seoDescription === "string") {
    return output.seoDescription;
  }

  if (item.action === "title") {
    return toStringList(output.titles).join(" / ") || "-";
  }

  if (item.action === "slug" && typeof output.slug === "string") {
    return output.slug;
  }

  if (item.action === "tags") {
    return toStringList(output.names).join("、") || toStringList(output.newTagNames).join("、") || "-";
  }

  if (item.action === "category") {
    return [output.categoryName, output.reason].filter((value): value is string => typeof value === "string" && value.length > 0).join("：") || "-";
  }

  if (Object.keys(output).length === 0) {
    return "-";
  }

  return JSON.stringify(output);
}

/**
 * 只有成功、绑定文章且尚未应用的任务项可以直接应用。
 */
function isOneClickArticleInfoTask(task: TaskDetail) {
  const metadata = readMetadata(task.metadata);
  return task.type === "post-article-info" || metadata.oneClick === true;
}

function canApply(task: TaskDetail, item: TaskItem) {
  return !isOneClickArticleInfoTask(task) && item.status === "SUCCEEDED" && Boolean(item.postId) && !item.applied;
}

function getArticleInfoSummary(task: TaskDetail): ArticleInfoSummary {
  const metadata = readMetadata(task.metadata);
  const partial = metadata.partial === true;
  const fromMetadata = partial ? {} : readMetadata(metadata.articleInfo);
  const outputByAction = new Map(task.items.map((item) => [item.action, readOutput(item.output)]));

  return {
    slug: typeof fromMetadata.slug === "string" ? fromMetadata.slug : readString(readOutput(outputByAction.get("slug")).slug),
    excerpt: typeof fromMetadata.excerpt === "string" ? fromMetadata.excerpt : readString(readOutput(outputByAction.get("summary")).summary),
    seoDescription:
      typeof fromMetadata.seoDescription === "string" ? fromMetadata.seoDescription : readString(readOutput(outputByAction.get("seo-description")).seoDescription),
    categoryName:
      typeof fromMetadata.categoryName === "string" ? fromMetadata.categoryName : readString(readOutput(outputByAction.get("category")).categoryName),
    tagNames: Array.isArray(fromMetadata.tagNames) ? toStringList(fromMetadata.tagNames) : toStringList(readOutput(outputByAction.get("tags")).names),
    partial,
    quality: readMetadata(metadata.quality),
  };
}

/**
 * AI 任务详情页。
 *
 * 负责展示任务聚合信息、逐条输出、失败原因，并提供失败项重试和单项应用入口。
 */
export function AiTaskDetail({ task }: { task: TaskDetail }) {
  const router = useRouter();
  const [items, setItems] = useState(task.items);
  const [serverItems, setServerItems] = useState(task.items);
  const [retrying, setRetrying] = useState(false);
  const [applyingItemId, setApplyingItemId] = useState<string | null>(null);
  if (serverItems !== task.items) {
    setServerItems(task.items);
    setItems(task.items);
  }
  const failedCount = useMemo(() => items.filter((item) => item.status === "FAILED").length, [items]);
  const oneClickArticleInfoTask = isOneClickArticleInfoTask(task);
  const articleInfoSummary = oneClickArticleInfoTask ? getArticleInfoSummary({ ...task, items }) : null;
  const retryDisabled = failedCount === 0 || retrying || oneClickArticleInfoTask;

  /**
   * 为失败任务项创建新的重试任务，并跳转到新任务详情页。
   */
  async function retryFailedItems() {
    if (retryDisabled) {
      return;
    }

    setRetrying(true);
    try {
      const data = await apiMutate<{ success?: boolean; data?: { id: string } }>(`/api/admin/ai/tasks/${task.id}/retry`, { method: "POST" });

      toast.success("已创建失败项重试任务");
      router.push(`/admin/ai/tasks/${data.data?.id ?? task.id}`);
    } catch (error) {
      toast.error(toErrorMessage(error, "重试任务失败"));
    } finally {
      setRetrying(false);
    }
  }

  /**
   * 应用单条 AI 建议。
   *
   * 成功后只更新当前行 applied 状态，同时刷新路由以同步文章侧数据。
   */
  async function applyItem(itemId: string) {
    setApplyingItemId(itemId);
    try {
      await apiMutate("/api/admin/ai/actions/apply", {
        method: "POST",
        body: JSON.stringify({ itemId }),
      });

      setItems((current) => current.map((item) => (item.id === itemId ? { ...item, applied: true } : item)));
      toast.success("AI 建议已应用");
      router.refresh();
    } catch (error) {
      toast.error(toErrorMessage(error, "应用建议失败"));
    } finally {
      setApplyingItemId(null);
    }
  }

  const metrics: Array<[string, string | number]> = [
    ["请求项", task.requestedCount],
    ["成功", task.succeededCount],
    ["失败", task.failedCount],
    ["耗时", formatDuration(task)],
    ["创建时间", formatDate(task.createdAt)],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="ai-task-summary-title">
        <AdminSectionHeader
          id="ai-task-summary-title"
          title={taskTypeLabels[task.type] ?? task.type}
          aside={
            <>
              <StatusText status={task.status} />
              <Button type="button" size="sm" variant="outline" disabled={retryDisabled} onClick={() => void retryFailedItems()}>
                {retrying ? "重试中..." : oneClickArticleInfoTask && failedCount > 0 ? "回编辑器重试" : "重试失败项"}
              </Button>
            </>
          }
        />
        <p className="mt-1.5 font-mono text-[0.8125rem] text-[var(--text-muted)]">
          {task.source}
          <span className="ed-meta-sep" aria-hidden="true"> · </span>
          {task.modelId ?? "默认模型"}
          <span className="ed-meta-sep" aria-hidden="true"> · </span>
          <span className="font-sans">{task.createdBy?.name ?? task.createdBy?.email ?? "系统"}</span>
        </p>

        <dl className="mt-4 grid grid-cols-2 border-y border-[var(--border)] sm:grid-cols-5">
          {metrics.map(([label, value], index) => (
            <div key={label} className={cn("min-w-0 px-4 py-3", index > 0 && "sm:border-l sm:border-[var(--border)]", index % 2 === 1 && "border-l border-[var(--border)]")}>
              <dt className="text-xs text-[var(--text-muted)]">{label}</dt>
              <dd
                className={cn(
                  "mt-1 truncate font-mono text-lg font-bold tabular-nums",
                  label === "失败" && Number(value) > 0 ? "text-[var(--danger-foreground)]" : "text-[var(--foreground)]",
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>

        {task.lastError ? (
          <p role="alert" className="ed-banner ed-banner--danger mt-4">
            {task.lastError}
          </p>
        ) : null}
        {oneClickArticleInfoTask && failedCount > 0 ? (
          <p role="status" className="ed-banner ed-banner--warning mt-4">
            一键文章信息任务不会在任务中心直接写库；请回到文章编辑器确认可用结果或重新生成失败项。
          </p>
        ) : null}
      </section>

      {articleInfoSummary ? (
        <section aria-labelledby="ai-task-article-info-title">
          <AdminSectionHeader
            id="ai-task-article-info-title"
            title="文章信息结果"
            description="组合查看一键生成结果，逐项明细仍保留在下方。"
            aside={
              typeof articleInfoSummary.quality.score === "number" ? (
                <span className="font-mono text-[var(--foreground)] tabular-nums">
                  <span className={cn("text-base font-bold", articleInfoSummary.quality.score >= 80 ? "" : "text-[var(--warning)]")}>
                    {articleInfoSummary.quality.score}
                  </span>{" "}
                  / 100
                </span>
              ) : articleInfoSummary.partial ? (
                <span className="text-xs font-bold text-[var(--warning)]">部分成功</span>
              ) : null
            }
          />
          <dl className="mt-2 grid grid-cols-[6rem_minmax(0,1fr)] text-[0.8125rem]">
            {[
              ["Slug", articleInfoSummary.slug],
              ["摘要", articleInfoSummary.excerpt],
              ["SEO 描述", articleInfoSummary.seoDescription],
              ["分类", articleInfoSummary.categoryName],
              ["标签", Array.isArray(articleInfoSummary.tagNames) ? articleInfoSummary.tagNames.join("、") : ""],
            ].map(([label, value]) => {
              const hasValue = typeof value === "string" && value.trim().length > 0;
              return (
                <div key={label} className="contents">
                  <dt className="border-b border-[var(--border)] py-2.5 text-[var(--text-muted)]">{label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 border-b border-[var(--border)] py-2.5 leading-6 break-words",
                      hasValue ? "text-[var(--foreground)]" : "text-[var(--text-muted)]",
                      label === "Slug" && hasValue && "font-mono text-xs",
                    )}
                  >
                    {hasValue ? value : "-"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ) : null}

      <section aria-labelledby="ai-task-items-title">
        <AdminSectionHeader
          id="ai-task-items-title"
          title="任务项"
          description="逐条查看输出、失败原因和应用状态。"
          aside={<span className="font-mono">{items.length} 项</span>}
        />
        <Table className="mt-2 min-w-[980px] table-fixed">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-20" />
            <col className="w-20" />
            <col />
            <col className="w-[18%]" />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <TableHeader>
            <TableRow>
              {["文章", "动作", "状态", "输出预览", "错误", "应用", "更新时间"].map((label) => (
                <TableHead key={label}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const preview = renderOutput(item);
              return (
                <TableRow key={item.id}>
                  <TableCell className="overflow-hidden">
                    {item.post ? (
                      <Link
                        className="block truncate font-medium text-[var(--foreground)] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-[var(--accent-sky)]"
                        href={`/admin/posts/${item.post.id}/edit`}
                        title={item.post.title}
                      >
                        {item.post.title}
                      </Link>
                    ) : task.source === "draft-post" ? (
                      <span className="text-[0.8125rem] text-[var(--text-muted)]">未保存草稿</span>
                    ) : (
                      <span className="text-[0.8125rem] text-[var(--text-muted)]">文章不存在</span>
                    )}
                  </TableCell>
                  <TableCell className="text-[0.8125rem] text-[var(--foreground)]">{actionLabels[item.action] ?? item.action}</TableCell>
                  <TableCell>
                    <StatusText status={item.status} />
                  </TableCell>
                  <TableCell className="overflow-hidden text-[0.8125rem] text-[var(--text-body)]">
                    <span className="block truncate" title={preview}>
                      {preview}
                    </span>
                  </TableCell>
                  <TableCell className="overflow-hidden text-[0.8125rem] text-[var(--danger-foreground)]">
                    {item.error ? (
                      <span className="block truncate" title={item.error}>
                        {item.error}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {oneClickArticleInfoTask && item.status === "SUCCEEDED" ? (
                      <span className="text-xs font-bold text-[var(--warning)]">待表单确认</span>
                    ) : item.applied ? (
                      <span className="text-xs font-bold text-[var(--success)]">已应用</span>
                    ) : canApply(task, item) ? (
                      <button
                        type="button"
                        className={adminTextActionClassName}
                        disabled={applyingItemId === item.id}
                        onClick={() => void applyItem(item.id)}
                      >
                        {applyingItemId === item.id ? "应用中..." : "应用"}
                      </button>
                    ) : (
                      <span className="text-[0.8125rem] text-[var(--text-muted)]">-</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-[var(--text-muted)] tabular-nums">{formatDate(item.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
