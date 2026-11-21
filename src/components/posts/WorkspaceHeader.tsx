"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";

type WorkspaceHeaderProps = {
  isEditMode: boolean;
  published: boolean;
  saveStatusLabel: string;
  saving: boolean;
  canSubmit: boolean;
  previewHref: string | null;
  scheduledAt: string;
  onBack: () => void;
};

/**
 * 文章工作台顶栏：返回、标题、状态徽标与提交动作。
 * 提交按钮使用原生表单 submit（name="intent"），必须渲染在 <form> 内部才能生效。
 */
export function WorkspaceHeader({
  isEditMode,
  published,
  saveStatusLabel,
  saving,
  canSubmit,
  previewHref,
  scheduledAt,
  onBack,
}: WorkspaceHeaderProps) {
  return (
    <header className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <button
            type="button"
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            onClick={onBack}
          >
            ‹ 返回文章
          </button>
          <span className="hidden h-3.5 w-px bg-[var(--border)] sm:inline-block" aria-hidden="true" />
          <h1 className="font-display text-base font-bold text-[var(--foreground)]">
            {isEditMode ? "编辑文章" : "新建文章"}
          </h1>
          <StatusBadge tone={published ? "success" : "warning"}>{published ? "已发布" : "草稿"}</StatusBadge>
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" aria-hidden="true" />
            {saveStatusLabel}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {previewHref ? (
            <Link
              className="ui-btn ui-ring inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              href={previewHref}
              target="_blank"
            >
              预览
            </Link>
          ) : (
            <Button type="button" disabled size="sm" variant="outline" className="h-8 shrink-0 whitespace-nowrap rounded-lg text-xs" title="草稿暂不支持前台预览">
              预览
            </Button>
          )}
          <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="draft" variant="outline" className="h-8 shrink-0 whitespace-nowrap rounded-lg text-xs">
            保存草稿
          </Button>
          <Button type="submit" disabled={saving || !canSubmit || !scheduledAt.trim()} size="sm" name="intent" value="schedule" variant="outline" className="h-8 shrink-0 whitespace-nowrap rounded-lg text-xs">
            定时发布
          </Button>
          <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="publish" className="h-8 shrink-0 whitespace-nowrap rounded-lg text-xs font-semibold">
            {saving ? "提交中..." : "发布文章"}
          </Button>
        </div>
      </div>
    </header>
  );
}
