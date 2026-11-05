"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";

import { Button, Modal } from "@/components/admin/ui";
import { StaggerItem, StaggerList, editorialEase } from "@/components/editorial";
import { cn } from "@/lib/cn";
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

const toneTextClassNames = {
  success: "text-[var(--success)]",
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger-foreground)]",
  info: "text-[var(--focus)]",
  muted: "text-[var(--text-muted)]",
} as const;

function getQualityToneClassName(status?: string) {
  if (status === "ok") return toneTextClassNames.success;
  if (status === "danger") return toneTextClassNames.danger;
  return toneTextClassNames.warning;
}

/** 变化列语气：将替换 warning、将补全 success、不覆盖 muted、标签增删为等宽 info */
function getChangeClassName(change: string) {
  if (change === "将替换") return toneTextClassNames.warning;
  if (change === "将补全") return toneTextClassNames.success;
  if (change === "不覆盖") return toneTextClassNames.muted;
  return cn(toneTextClassNames.info, "font-mono");
}

const placeholderValues = new Set(["未设置", "未选择", "未匹配", "保留原值"]);

function valueClassName(value: string, emphasis: boolean) {
  if (placeholderValues.has(value)) return "text-[var(--text-muted)]";
  return emphasis ? "text-[var(--foreground)]" : "text-[var(--text-body)]";
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
  const reduceMotion = useReducedMotion();

  const metricsLine = preview.metrics
    .filter((metric) => metric.action)
    .map((metric) => `${articleInfoActionLabels[metric.action] ?? metric.action} ${metric.durationMs}ms`)
    .join(" / ");
  const qualityScore = preview.quality?.score;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="确认一键 AI 生成结果"
      size="3xl"
      contentClassName="flex flex-col gap-4 px-6 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="min-w-0 text-[0.8125rem] text-[var(--text-body)]">
          <span className={cn("mr-2 text-xs font-bold", preview.partial ? toneTextClassNames.warning : toneTextClassNames.muted)}>
            {preview.partial ? "部分字段可用" : "生成结果待确认"}
          </span>
          标题和正文不会被覆盖；不覆盖项会保留当前表单值。
        </p>
        <Link
          className="inline-flex min-h-6 items-center text-[0.8125rem] font-bold text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)]"
          href={preview.taskHref}
        >
          查看 AI 任务
        </Link>
      </div>

      <StaggerList as="ul" className="sm:hidden" stagger={0.04}>
        {rows.map((row) => (
          <StaggerItem as="li" key={row.key} className="border-b border-[var(--border)] py-3 first:border-t first:border-t-[var(--reader-border-strong)]">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.8125rem] font-bold text-[var(--foreground)]">{row.label}</span>
              <span className={cn("shrink-0 text-xs font-bold", getChangeClassName(row.change))}>{row.change}</span>
            </div>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">当前</p>
            <p className={cn("break-words text-[0.8125rem] leading-[1.6]", valueClassName(row.current, false))}>{row.current}</p>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">AI 建议</p>
            <p className={cn("break-words text-[0.8125rem] leading-[1.6]", valueClassName(row.next, true))}>{row.next}</p>
          </StaggerItem>
        ))}
      </StaggerList>

      <table className="hidden w-full table-fixed border-collapse text-[0.8125rem] sm:table" data-slot="ai-preview-table">
        <colgroup>
          <col className="w-24" />
          <col />
          <col />
          <col className="w-36" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--reader-border-strong)] text-left text-xs font-bold text-[var(--text-muted)]">
            <th scope="col" className="h-9 pr-3 font-bold">字段</th>
            <th scope="col" className="h-9 pr-3 font-bold">当前</th>
            <th scope="col" className="h-9 pr-3 font-bold">AI 建议</th>
            <th scope="col" className="h-9 font-bold">变化</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <motion.tr
              key={row.key}
              className="border-b border-[var(--border)] align-top"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: editorialEase, delay: reduceMotion ? 0 : 0.04 * index } }}
            >
              <th scope="row" className="py-3 pr-3 text-left font-bold text-[var(--foreground)]">{row.label}</th>
              <td className={cn("min-w-0 break-words py-3 pr-3 leading-[1.6]", row.key === "slug" && "font-mono text-xs", valueClassName(row.current, false))}>
                {row.current}
              </td>
              <td className={cn("min-w-0 break-words py-3 pr-3 leading-[1.6]", row.key === "slug" && "font-mono text-xs", valueClassName(row.next, true))}>
                {row.next}
              </td>
              <td className={cn("py-3 text-xs font-bold", getChangeClassName(row.change))}>{row.change}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>

      {preview.quality ? (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)]" data-slot="ai-preview-quality">
          <div>
            <p className="text-xs font-bold text-[var(--text-muted)]">质量评分</p>
            <p className="mt-1 font-mono text-[var(--foreground)] tabular-nums">
              <span className={cn("text-xl font-bold", (qualityScore ?? 0) >= 80 ? "text-[var(--foreground)]" : toneTextClassNames.warning)}>
                {qualityScore ?? "-"}
              </span>
              <span className="text-[0.8125rem] text-[var(--text-muted)]"> / 100</span>
            </p>
          </div>
          <ul className="space-y-1">
            {(preview.quality.checks ?? []).map((check) => (
              <li key={check.key || check.label} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 text-[0.8125rem] leading-[1.6]">
                <span className={cn("text-xs font-bold leading-[1.85]", getQualityToneClassName(check.status))}>
                  {check.status === "danger" ? "阻止" : check.status === "ok" ? "通过" : "注意"}
                </span>
                <span className="min-w-0 text-[var(--text-body)]">
                  <span className="text-[var(--foreground)]">{check.label}</span>
                  {check.message ? <span className="block text-xs text-[var(--text-muted)]">{check.message}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview.failures.length > 0 ? (
        <p role="status" className="border-l-2 border-[var(--warning)] py-0.5 pl-3 text-[0.8125rem] font-bold text-[var(--warning)]">
          {preview.failures.map((failure) => articleInfoActionLabels[failure.action] ?? failure.action).join("、")} 生成失败，其余字段可确认应用。
        </p>
      ) : null}

      {metricsLine ? <p className="font-mono text-xs text-[var(--text-muted)]">耗时：{metricsLine}</p> : null}

      <div className="-mx-6 -mb-4 flex flex-wrap justify-end gap-2.5 border-t border-[var(--border)] px-6 py-3.5">
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
