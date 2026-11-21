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
    <header className="ui-surface rounded-2xl px-4 py-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            className="text-sm font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
            onClick={onBack}
          >
            ← 返回文章
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-xl font-semibold text-[var(--foreground)]">
              {isEditMode ? "编辑文章" : "新建文章"}
            </h1>
            <StatusBadge tone={published ? "success" : "warning"}>{published ? "已发布" : "草稿"}</StatusBadge>
            <span className="text-sm text-[var(--muted)]">{saveStatusLabel}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {previewHref ? (
            <Link
              className="ui-btn ui-ring inline-flex items-center justify-center rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              href={previewHref}
              target="_blank"
            >
              预览
            </Link>
          ) : (
            <Button type="button" disabled size="sm" variant="outline" title="草稿暂不支持前台预览">
              预览
            </Button>
          )}
          <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="draft" variant="outline">
            保存草稿
          </Button>
          <Button type="submit" disabled={saving || !canSubmit || !scheduledAt.trim()} size="sm" name="intent" value="schedule" variant="outline">
            定时发布
          </Button>
          <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="publish">
            {saving ? "提交中..." : "发布文章"}
          </Button>
        </div>
      </div>
    </header>
  );
}
