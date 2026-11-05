"use client";

import { CalendarClock } from "lucide-react";

import { FieldLabel, RadioChoiceGroup } from "@/components/admin/workspace/WorkspaceKit";
import { cn } from "@/lib/cn";
import type { CategoryOption, SeriesOption } from "./workspace-types";

type PublishSettingsPanelProps = {
  isEditMode: boolean;
  saveStatusLabel: string;
  published: boolean;
  featured: boolean;
  scheduledAt: string;
  slug: string;
  categoryId: string;
  tagCount: number;
  seriesId: string;
  coverImage: string;
  categories: CategoryOption[];
  series: SeriesOption[];
  onKeepDraft: () => void;
  onSwitchPublished: () => void;
  onUnfeature: () => void;
  onFeature: () => void;
  onScheduledAtChange: (value: string) => void;
};

type SummaryRow = { label: string; value: string; empty: boolean; mono?: boolean };

/**
 * 「发布设置」面板内容（方向 A 第 15 节 A1）：发布状态、精选状态两个单选组（选中只改表单值，
 * 仍需「保存草稿」或「发布文章」提交），定时发布时间，以及 64px 键列的细线定义列表摘要。
 * 原来的禁用静态评论开关按已采纳假设去掉（文章接口没有评论开关字段）。
 * 纯展示组件，所有变更经回调上抛，由工作台统一 setFormData。
 */
export function PublishSettingsPanel({
  isEditMode,
  saveStatusLabel,
  published,
  featured,
  scheduledAt,
  slug,
  categoryId,
  tagCount,
  seriesId,
  coverImage,
  categories,
  series,
  onKeepDraft,
  onSwitchPublished,
  onUnfeature,
  onFeature,
  onScheduledAtChange,
}: PublishSettingsPanelProps) {
  const scheduleInputId = isEditMode ? "edit-post-scheduled-at" : "create-post-scheduled-at";
  const categoryName = categories.find((category) => category.id === categoryId)?.name;
  const seriesTitle = series.find((item) => item.id === seriesId)?.title;
  const summaryRows: SummaryRow[] = [
    { label: "永久链接", value: slug ? `/posts/${slug}` : "未生成", empty: !slug, mono: Boolean(slug) },
    { label: "分类", value: categoryName ?? "未选择", empty: !categoryName },
    { label: "标签", value: tagCount > 0 ? `${tagCount} 个` : "未选择", empty: tagCount === 0 },
    { label: "系列", value: seriesTitle ?? "未选择", empty: !seriesTitle },
    { label: "排程", value: scheduledAt ? scheduledAt.replace("T", " ") : "未设置", empty: !scheduledAt, mono: Boolean(scheduledAt) },
    { label: "封面图", value: coverImage ? "已设置" : "未设置", empty: !coverImage },
  ];

  return (
    <div className="flex flex-col gap-3.5" data-slot="publish-settings">
      <RadioChoiceGroup
        label="发布状态"
        name={`${isEditMode ? "edit" : "create"}-post-published`}
        value={published ? "published" : "draft"}
        options={[
          { value: "draft", label: "草稿" },
          { value: "published", label: "已发布" },
        ]}
        onChange={(next) => (next === "published" ? onSwitchPublished() : onKeepDraft())}
        description={isEditMode ? "切换后通过保存或发布提交。" : saveStatusLabel}
      />

      <RadioChoiceGroup
        label="精选状态"
        name={`${isEditMode ? "edit" : "create"}-post-featured`}
        value={featured ? "featured" : "normal"}
        options={[
          { value: "normal", label: "普通" },
          { value: "featured", label: "精选" },
        ]}
        onChange={(next) => (next === "featured" ? onFeature() : onUnfeature())}
        description="最多 3 篇精选文章会展示在前台。"
      />

      <div className="min-w-0">
        <div className="mb-1.5">
          <FieldLabel htmlFor={scheduleInputId} optional>
            定时发布时间
          </FieldLabel>
        </div>
        <div className="relative">
          <input
            id={scheduleInputId}
            type="datetime-local"
            aria-describedby={`${scheduleInputId}-hint`}
            className="h-9 w-full min-w-0 rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-9 pl-2.5 font-mono text-[0.8125rem] text-[var(--foreground)] transition-[border-color] duration-150 hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:size-5 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
            value={scheduledAt}
            onChange={(event) => onScheduledAtChange(event.target.value)}
          />
          <CalendarClock aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-[15px] -translate-y-1/2 text-[var(--text-muted)]" />
        </div>
        <p id={`${scheduleInputId}-hint`} className="mt-1.5 text-xs leading-[1.55] text-[var(--text-muted)]">
          留空则使用“发布文章”立即发布；填写未来时间后点击“定时发布”。
        </p>
      </div>

      <dl className="grid grid-cols-[64px_minmax(0,1fr)] gap-x-3 gap-y-[5px] border-t border-[var(--border)] pt-2.5 text-[0.8125rem] leading-normal">
        {summaryRows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-[var(--text-muted)]">{row.label}</dt>
            <dd
              className={cn(
                "min-w-0 [overflow-wrap:anywhere] transition-colors duration-200",
                row.empty ? "text-[var(--text-muted)]" : "text-[var(--foreground)]",
                row.mono && "font-mono text-xs tabular-nums",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
