"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button, Modal } from "@/components/admin/ui";
import type { AiArticleInfoPreview } from "./hooks/useAiActions";
import type { CategoryOption, TagOption } from "./workspace-types";

const articleInfoActionLabels: Record<string, string> = {
  slug: "Slug",
  summary: "摘要",
  "seo-description": "SEO 描述",
  category: "分类",
  tags: "标签",
};

function formatPreviewValue(value: string) {
  return value.trim() || "未设置";
}

function getQualityTone(status?: string) {
  if (status === "ok") return "success";
  if (status === "danger") return "danger";
  return "warning";
}

function getTagNames(ids: string[], tags: TagOption[]) {
  return ids.map((id) => tags.find((tag) => tag.id === id)?.name ?? id);
}

function getArticleInfoPreviewRows({
  categories,
  preview,
  tags,
}: {
  categories: CategoryOption[];
  preview: AiArticleInfoPreview;
  tags: TagOption[];
}) {
  const currentTagIds = preview.original.tagIds;
  const nextTagIds = Array.isArray(preview.suggestion.tagIds) ? preview.suggestion.tagIds : [];
  const addedTags = nextTagIds.filter((id) => !currentTagIds.includes(id));
  const removedTags = currentTagIds.filter((id) => !nextTagIds.includes(id));
  const keptTags = nextTagIds.filter((id) => currentTagIds.includes(id));

  return [
    {
      key: "slug",
      label: "Slug",
      current: formatPreviewValue(preview.original.slug),
      next: preview.fields.slug ? formatPreviewValue(preview.suggestion.slug ?? "") : "保留原值",
      change: preview.fields.slug ? (preview.original.slug ? "将替换" : "将补全") : "不覆盖",
    },
    {
      key: "excerpt",
      label: "摘要",
      current: formatPreviewValue(preview.original.excerpt),
      next: preview.fields.excerpt ? formatPreviewValue(preview.suggestion.excerpt ?? "") : "保留原值",
      change: preview.fields.excerpt ? (preview.original.excerpt ? "将替换" : "将补全") : "不覆盖",
    },
    {
      key: "seoDescription",
      label: "SEO 描述",
      current: formatPreviewValue(preview.original.seoDescription),
      next: preview.fields.seoDescription ? formatPreviewValue(preview.suggestion.seoDescription ?? "") : "保留原值",
      change: preview.fields.seoDescription ? (preview.original.seoDescription ? "将替换" : "将补全") : "不覆盖",
    },
    {
      key: "category",
      label: "分类",
      current: categories.find((category) => category.id === preview.original.categoryId)?.name ?? "未选择",
      next: preview.fields.categoryId ? categories.find((category) => category.id === preview.suggestion.categoryId)?.name ?? "未匹配" : "保留原值",
      change: preview.fields.categoryId ? (preview.original.categoryId ? "将替换" : "将补全") : "不覆盖",
    },
    {
      key: "tags",
      label: "标签",
      current: getTagNames(currentTagIds, tags).join("、") || "未选择",
      next: preview.fields.tagIds ? getTagNames(nextTagIds, tags).join("、") || "未匹配" : "保留原值",
      change: preview.fields.tagIds
        ? [`新增 ${addedTags.length}`, `保留 ${keptTags.length}`, `移除 ${removedTags.length}`].join(" / ")
        : "不覆盖",
    },
  ];
}

type ArticleInfoPreviewModalProps = {
  preview: AiArticleInfoPreview;
  categories: CategoryOption[];
  tags: TagOption[];
  onClose: () => void;
  onApply: () => void;
};

/**
 * 「确认一键 AI 生成结果」弹窗：移动端卡片 / 桌面表格两种形态的字段对比预览、
 * 质量评分、失败与耗时摘要。
 * 纯展示组件，确认/取消经回调上抛。
 */
export function ArticleInfoPreviewModal({
  preview,
  categories,
  tags,
  onClose,
  onApply,
}: ArticleInfoPreviewModalProps) {
  const rows = getArticleInfoPreviewRows({ categories, preview, tags });

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="确认一键 AI 生成结果"
      size="3xl"
      contentClassName="space-y-4 px-4 py-4 sm:px-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {preview.partial ? "部分字段可用" : "生成结果待确认"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">标题和正文不会被覆盖；不覆盖项会保留当前表单值。</p>
        </div>
        <Link className="text-sm font-medium text-[var(--brand)] hover:underline" href={preview.taskHref}>
          查看 AI 任务
        </Link>
      </div>

      <div className="space-y-2 sm:hidden">
        {rows.map((row) => (
          <div key={row.key} className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-3">
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--foreground)]">{row.label}</span>
              <span className="shrink-0 text-xs font-medium text-[var(--brand)]">{row.change}</span>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--muted)]">当前</p>
                <p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">{row.current}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--muted)]">AI 建议</p>
                <p className="mt-1 break-words text-sm leading-6 text-[var(--foreground)]">{row.next}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] sm:block">
        <div className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-0 border-b border-[var(--border)] bg-[var(--surface-alt)] text-xs font-semibold text-[var(--muted)]">
          <span className="px-3 py-2">字段</span>
          <span className="px-3 py-2">当前</span>
          <span className="px-3 py-2">AI 建议</span>
          <span className="px-3 py-2">变化</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[6rem_minmax(0,1fr)_minmax(0,1fr)_7rem] gap-0 text-sm">
              <span className="px-3 py-3 font-medium text-[var(--foreground)]">{row.label}</span>
              <span className="min-w-0 break-words px-3 py-3 text-[var(--muted)]">{row.current}</span>
              <span className="min-w-0 break-words px-3 py-3 text-[var(--foreground)]">{row.next}</span>
              <span className="px-3 py-3 text-xs font-medium text-[var(--brand)]">{row.change}</span>
            </div>
          ))}
        </div>
      </div>

      {preview.quality ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-[var(--foreground)]">质量评分</p>
            <StatusBadge tone={(preview.quality.score ?? 0) >= 80 ? "success" : "warning"}>
              {preview.quality.score ?? "-"} / 100
            </StatusBadge>
          </div>
          <div className="mt-3 grid gap-2">
            {(preview.quality.checks ?? []).map((check) => (
              <div key={check.key || check.label} className="flex items-start justify-between gap-3 rounded-xl bg-[var(--surface)] px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--foreground)]">{check.label}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{check.message}</p>
                </div>
                <StatusBadge tone={getQualityTone(check.status)}>{check.status === "danger" ? "阻止" : check.status === "ok" ? "通过" : "注意"}</StatusBadge>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {preview.failures.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {preview.failures.map((failure) => articleInfoActionLabels[failure.action] ?? failure.action).join("、")} 生成失败，其余字段可确认应用。
        </div>
      ) : null}

      {preview.metrics.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          耗时：
          {preview.metrics
            .filter((metric) => metric.action)
            .map((metric) => `${articleInfoActionLabels[metric.action] ?? metric.action} ${metric.durationMs}ms`)
            .join(" / ")}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="button" onClick={onApply}>
          应用这些结果
        </Button>
      </div>
    </Modal>
  );
}
