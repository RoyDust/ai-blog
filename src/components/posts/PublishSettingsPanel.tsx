"use client";

import { CalendarClock } from "lucide-react";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button, Input } from "@/components/admin/ui";
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

/**
 * 「发布设置」面板内容：发布/精选状态切换、定时发布、评论开关与永久链接摘要。
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
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-[var(--foreground)]">发布状态</p>
          <p className="text-sm text-[var(--muted)]">{isEditMode ? "切换后通过保存或发布提交。" : saveStatusLabel}</p>
        </div>
        <StatusBadge tone={published ? "success" : "warning"}>{published ? "已发布" : "草稿"}</StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          type="button"
          size="sm"
          variant={published ? "outline" : "primary"}
          disabled={!published}
          onClick={onKeepDraft}
        >
          保持草稿
        </Button>
        <Button
          type="button"
          size="sm"
          variant={published ? "primary" : "outline"}
          disabled={published}
          onClick={onSwitchPublished}
        >
          切换为已发布
        </Button>
      </div>

      <div className="space-y-3 border-t border-[var(--border)] pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-[var(--foreground)]">精选状态</p>
            <p className="text-sm text-[var(--muted)]">最多 3 篇精选文章会展示在前台。</p>
          </div>
          <StatusBadge tone={featured ? "success" : "neutral"}>{featured ? "精选" : "普通"}</StatusBadge>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            type="button"
            size="sm"
            variant={featured ? "outline" : "primary"}
            disabled={!featured}
            onClick={onUnfeature}
          >
            取消精选
          </Button>
          <Button
            type="button"
            size="sm"
            variant={featured ? "primary" : "outline"}
            disabled={featured}
            onClick={onFeature}
          >
            设为精选
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          label="定时发布时间"
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => onScheduledAtChange(event.target.value)}
        />
        <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
          <CalendarClock className="h-3.5 w-3.5" />
          留空则使用“发布文章”立即发布；填写未来时间后点击“定时发布”。
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm">
        <span className="text-[var(--foreground)]">允许评论</span>
        <input type="checkbox" disabled className="h-4 w-4 rounded border-[var(--border)]" />
      </label>
      <p className="text-xs text-[var(--muted)]">静态开关，当前文章接口没有评论开关字段。</p>

      <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
        <p>永久链接：{slug ? `/posts/${slug}` : "未生成"}</p>
        <p>分类：{categories.find((category) => category.id === categoryId)?.name ?? "未选择"}</p>
        <p>标签：{tagCount > 0 ? `${tagCount} 个` : "未选择"}</p>
        <p>系列：{series.find((item) => item.id === seriesId)?.title ?? "未选择"}</p>
        <p>排程：{scheduledAt ? scheduledAt.replace("T", " ") : "未设置"}</p>
        <p>封面图：{coverImage ? "已设置" : "未设置"}</p>
      </div>
    </div>
  );
}
