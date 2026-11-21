"use client";

/**
 * 后台文章列表的展示组件与纯函数助手（方向 A）。
 * 与数据层 hook（usePostsList）分离，便于页面壳组装与复用。
 */

import Link from "next/link";
import { type ReactNode } from "react";

import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { StatusBadge, type StatusTone } from "@/components/admin/primitives/StatusBadge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PostSummaryStatus } from "@/lib/post-summary-status";
import type { PostRow } from "./hooks/usePostsList";

export const placeholder = "-";

export function fallbackText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : placeholder;
}

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN")
    : placeholder;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleDateString("zh-CN");
}

/** AI 摘要状态：语气色文字（已生成 success、生成中 info、排队中 warning、失败 danger、未生成 muted） */
export function getSummaryMeta(status: PostSummaryStatus): { label: string; tone: StatusTone } {
  if (status === "QUEUED") return { label: "排队中", tone: "warning" };
  if (status === "GENERATING") return { label: "生成中", tone: "info" };
  if (status === "FAILED") return { label: "失败", tone: "danger" };
  if (status === "GENERATED") return { label: "已生成", tone: "success" };
  return { label: "未生成", tone: "muted" };
}

export function getPreviewHref(row: PostRow) {
  const slug = row.slug?.trim();
  if (!slug) return null;
  return row.published ? `/posts/${slug}` : `/admin/posts/preview/${slug}`;
}

/**
 * 发布列：状态文字（已发布 success / 草稿 warning）+ 下划线文字按钮（转草稿 / 发布）。
 * 点击只请求切换（发布方向会先弹确认），处理中按钮禁用。
 */
export function PublishToggleTag({
  busy,
  onRequestTogglePublish,
  published,
}: {
  busy: boolean;
  onRequestTogglePublish: () => void;
  published: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5 whitespace-nowrap">
      <StatusBadge tone={published ? "success" : "warning"}>{published ? "已发布" : "草稿"}</StatusBadge>
      <button
        aria-busy={busy || undefined}
        aria-label={published ? "切换为草稿" : "切换为已发布"}
        className={adminTextActionClassName}
        disabled={busy}
        onClick={onRequestTogglePublish}
        type="button"
      >
        {busy ? "处理中…" : published ? "转草稿" : "发布"}
      </button>
    </span>
  );
}

/** 行内操作：编辑、预览（无 slug 时置灰并提示「缺少 slug」）、删除（danger） */
export function PostRowActions({ row, onDelete }: { row: PostRow; onDelete: () => void }) {
  const previewHref = getPreviewHref(row);

  return (
    <span className="flex items-center justify-end gap-3 whitespace-nowrap">
      <Link className={adminTextActionClassName} href={`/admin/posts/${row.id}/edit`}>
        编辑
      </Link>
      {previewHref ? (
        <Link className={adminTextActionClassName} href={previewHref}>
          预览
        </Link>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-disabled="true"
              aria-label="预览"
              className={cn(adminTextActionClassName, "cursor-not-allowed text-[var(--text-muted)] no-underline opacity-60 hover:text-[var(--text-muted)]")}
              onClick={(event) => event.preventDefault()}
              type="button"
            >
              预览
            </button>
          </TooltipTrigger>
          <TooltipContent sideOffset={6}>缺少 slug</TooltipContent>
        </Tooltip>
      )}
      <button aria-label="删除" className={adminTextActionDangerClassName} onClick={onDelete} type="button">
        删除
      </button>
    </span>
  );
}

/** AI 摘要列：状态 + 同一行截断的预览；失败时换成错误原因（danger） */
export function SummaryCell({ status, text }: { status: PostSummaryStatus; text: ReactNode }) {
  const meta = getSummaryMeta(status);

  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[0.8125rem] text-[var(--text-muted)]",
          status === "FAILED" && "text-[var(--danger-foreground)]",
        )}
      >
        {text}
      </span>
    </span>
  );
}
