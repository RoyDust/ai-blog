"use client";

import Link from "next/link";

import { Button } from "@/components/admin/ui";
import { HintTooltip } from "@/components/admin/workspace/WorkspaceKit";
import { cn } from "@/lib/cn";

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

const outlineLinkClassName =
  "inline-flex h-9 shrink-0 items-center justify-center rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] px-3.5 text-[0.8125rem] font-bold whitespace-nowrap text-[var(--foreground)] transition-[border-color,background-color] duration-150 hover:border-[var(--foreground)] active:bg-[var(--ed-press-bg)]";

/**
 * 文章工作台页头（方向 A 第 15 节）：「返回文章」下划线文字链接、衬线 28px 标题，
 * 同一基线跟语气色状态（已发布 success / 草稿 warning）与保存说明，右侧四个无图标按钮，
 * 只有「发布文章」是实心主按钮；底部 2px foreground 粗线。
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
    <header
      className="flex shrink-0 flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-[var(--foreground)] pb-3"
      data-slot="workspace-header"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <button
          type="button"
          className="inline-flex min-h-6 cursor-pointer self-start text-[0.8125rem] font-bold text-[var(--text-muted)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)]"
          onClick={onBack}
        >
          返回文章
        </button>
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="font-serif text-[1.75rem] leading-[1.2] font-bold text-[var(--foreground)]">
            {isEditMode ? "编辑文章" : "新建文章"}
          </h1>
          <span
            className={cn(
              "text-xs leading-[1.4] font-bold whitespace-nowrap transition-colors duration-200",
              published ? "text-[var(--success)]" : "text-[var(--warning)]",
            )}
          >
            {published ? "已发布" : "草稿"}
          </span>
          <span aria-hidden="true" className="text-[var(--reader-border-strong)]">
            ·
          </span>
          <span role="status" className="text-xs text-[var(--text-muted)]">
            {saveStatusLabel}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        {previewHref ? (
          <Link
            aria-disabled={saving || undefined}
            className={cn(outlineLinkClassName, saving && "pointer-events-none opacity-45")}
            href={previewHref}
            tabIndex={saving ? -1 : undefined}
            target="_blank"
          >
            预览
          </Link>
        ) : (
          <HintTooltip hint="草稿暂不支持前台预览" side="bottom">
            <Button type="button" disabled variant="outline" title="草稿暂不支持前台预览">
              预览
            </Button>
          </HintTooltip>
        )}
        <Button type="submit" disabled={saving || !canSubmit} name="intent" value="draft" variant="outline">
          保存草稿
        </Button>
        <Button type="submit" disabled={saving || !canSubmit || !scheduledAt.trim()} name="intent" value="schedule" variant="outline">
          定时发布
        </Button>
        <Button type="submit" disabled={saving || !canSubmit} name="intent" value="publish">
          {saving ? "提交中..." : "发布文章"}
        </Button>
      </div>
    </header>
  );
}
