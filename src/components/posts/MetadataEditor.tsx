"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { LoaderCircle, Sparkles } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";

import { CoverPicker } from "@/components/admin/covers/CoverPicker";
import type { CoverAsset } from "@/components/admin/covers/types";
import { Button, Input } from "@/components/admin/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import type { AiMetadataField, AiMetadataSingleField } from "./hooks/useAiActions";
import type { PostFormData } from "./hooks/usePostForm";
import { AiFieldButton } from "./AiFieldButton";
import type { CategoryOption, SeriesOption, TagOption, WorkspaceMode } from "./workspace-types";

const uncategorizedValue = "__uncategorized__";
const noSeriesValue = "__no_series__";
const adminSelectTriggerClassName = "w-full rounded-xl border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] shadow-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]";
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

const AiCoverGenerator = dynamic(
  () => import("@/components/admin/covers/AiCoverGenerator").then((mod) => mod.AiCoverGenerator),
  {
    ssr: false,
    loading: () => (
      <Button type="button" size="sm" variant="outline" disabled>
        AI 封面加载中
      </Button>
    ),
  },
);

type MetadataEditorProps = {
  mode: WorkspaceMode;
  formData: Pick<
    PostFormData,
    "categoryId" | "tagIds" | "seriesId" | "seriesOrder" | "coverImage" | "coverAssetId" | "excerpt" | "seoDescription" | "title" | "content"
  >;
  hasContent: boolean;
  canUseAiWorkspace: boolean;
  categories: CategoryOption[];
  tags: TagOption[];
  series: SeriesOption[];
  metadataError: string;
  metadataPendingField: AiMetadataField | null;
  isCompletingMetadata: boolean;
  isGeneratingAllMetadata: boolean;
  lastArticleInfoTaskId: string;
  isSummarizing: boolean;
  summaryError: string;
  coverUploadError: string | null;
  isCoverUploading: boolean;
  coverInputRef: RefObject<HTMLInputElement | null>;
  onGenerateAll: () => void;
  onOpenAiWorkspace: () => void;
  onGenerateMetadata: (field: AiMetadataSingleField) => void;
  onGenerateSummary: () => void;
  onCategoryChange: (value: string) => void;
  onTagToggle: (tagId: string, checked: boolean) => void;
  onSeriesChange: (value: string) => void;
  onSeriesOrderChange: (value: number) => void;
  onCoverUrlChange: (value: string) => void;
  onCoverUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverUploadClick: () => void;
  onCoverAssetSelect: (asset: CoverAsset) => void;
  onExcerptChange: (value: string) => void;
  onSeoDescriptionChange: (value: string) => void;
};

/**
 * 「分类、标签与封面图」面板内容：一键 AI 生成信息、分类/标签/系列选择、
 * 封面上传与图库选择、摘要与 SEO 描述。
 * 纯展示组件，所有变更经回调上抛，由工作台统一 setFormData。
 */
export function MetadataEditor({
  mode,
  formData,
  hasContent,
  canUseAiWorkspace,
  categories,
  tags,
  series,
  metadataError,
  metadataPendingField,
  isCompletingMetadata,
  isGeneratingAllMetadata,
  lastArticleInfoTaskId,
  isSummarizing,
  summaryError,
  coverUploadError,
  isCoverUploading,
  coverInputRef,
  onGenerateAll,
  onOpenAiWorkspace,
  onGenerateMetadata,
  onGenerateSummary,
  onCategoryChange,
  onTagToggle,
  onSeriesChange,
  onSeriesOrderChange,
  onCoverUrlChange,
  onCoverUpload,
  onCoverUploadClick,
  onCoverAssetSelect,
  onExcerptChange,
  onSeoDescriptionChange,
}: MetadataEditorProps) {
  return (
    <div className="space-y-4">
      {metadataError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{metadataError}</p> : null}

      <div className="rounded-2xl border border-[color-mix(in_oklab,var(--brand)_18%,var(--border)_82%)] bg-[color-mix(in_oklab,var(--brand)_5%,var(--surface)_95%)] p-3">
        <div className="flex flex-col gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">一键 AI 生成信息</p>
            <p className="text-xs leading-5 text-[var(--muted)]">保留标题和正文，覆盖 Slug、摘要、SEO、分类和标签。</p>
          </div>
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={isCompletingMetadata || !hasContent}
            onClick={onGenerateAll}
          >
            {isGeneratingAllMetadata ? (
              <LoaderCircle className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            {isGeneratingAllMetadata ? "生成中..." : "一键 AI 生成"}
          </Button>
          {canUseAiWorkspace ? (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={onOpenAiWorkspace}>
              <Sparkles className="mr-1 h-4 w-4" aria-hidden="true" />
              打开 AI 辅助
            </Button>
          ) : null}
          {lastArticleInfoTaskId ? (
            <Link className="text-xs font-medium text-[var(--brand)] hover:underline" href={`/admin/ai/tasks/${lastArticleInfoTaskId}`}>
              查看最近 AI 任务
            </Link>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={`${mode}-post-category`}>
            分类
          </label>
          <AiFieldButton
            label="AI 选择分类"
            loading={metadataPendingField === "category"}
            disabled={isCompletingMetadata || !hasContent}
            onClick={() => onGenerateMetadata("category")}
          />
        </div>
        <Select
          value={formData.categoryId || uncategorizedValue}
          onValueChange={(value) => onCategoryChange(value === uncategorizedValue ? "" : value)}
        >
          <SelectTrigger id={`${mode}-post-category`} className={adminSelectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={adminSelectContentClassName}>
            <SelectItem value={uncategorizedValue}>未分类</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2" role="group" aria-labelledby={`${mode}-post-tags-label`}>
        <div className="flex items-center justify-between gap-3">
          <p id={`${mode}-post-tags-label`} className="text-sm font-medium text-[var(--foreground)]">标签</p>
          <AiFieldButton
            label="AI 选择标签"
            loading={metadataPendingField === "tags"}
            disabled={isCompletingMetadata || !hasContent}
            onClick={() => onGenerateMetadata("tags")}
          />
        </div>
        <div className="grid gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:grid-cols-2 xl:grid-cols-1">
          {tags.length === 0 ? <p className="text-sm text-[var(--muted)]">暂无可选标签</p> : null}
          {tags.map((tag) => {
            const inputId = `${mode}-post-tag-${tag.id}`;
            const checked = formData.tagIds.includes(tag.id);

            return (
              <label key={tag.id} htmlFor={inputId} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                <input
                  id={inputId}
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--border)]"
                  checked={checked}
                  onChange={(event) => onTagToggle(tag.id, event.target.checked)}
                />
                {tag.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem] xl:grid-cols-1">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={`${mode}-post-series`}>
            所属系列
          </label>
          <Select
            value={formData.seriesId || noSeriesValue}
            onValueChange={(value) => onSeriesChange(value === noSeriesValue ? "" : value)}
          >
            <SelectTrigger id={`${mode}-post-series`} className={adminSelectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={adminSelectContentClassName}>
              <SelectItem value={noSeriesValue}>不归入系列</SelectItem>
              {series.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Input
          label="系列排序"
          min={0}
          type="number"
          value={String(formData.seriesOrder)}
          onChange={(event) => onSeriesOrderChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
        />
      </div>

      <Input
        label="封面图 URL"
        placeholder="https://example.com/cover.jpg"
        value={formData.coverImage}
        onChange={(event) => onCoverUrlChange(event.target.value)}
      />

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={coverInputRef}
            accept="image/*"
            className="hidden"
            id={`${mode}-cover-upload`}
            type="file"
            onChange={onCoverUpload}
          />
          <Button type="button" size="sm" onClick={onCoverUploadClick} disabled={isCoverUploading}>
            {isCoverUploading ? "上传中..." : "上传并保存到图库"}
          </Button>
          <CoverPicker
            selectedAssetId={formData.coverAssetId}
            onSelect={onCoverAssetSelect}
          />
          <AiCoverGenerator
            title={formData.title}
            excerpt={formData.excerpt}
            content={formData.content}
            onGenerated={onCoverAssetSelect}
          />
          <p className="text-sm text-[var(--muted)]">选择图片后自动回填封面地址。</p>
        </div>
        {coverUploadError ? <p className="mt-2 text-sm text-rose-500">{coverUploadError}</p> : null}
      </div>
      <div className="space-y-2">
        <Input
          label="摘要"
          placeholder="文章摘要（可选）"
          rightSlot={
            <AiFieldButton
              label="AI 生成摘要"
              loading={isSummarizing}
              disabled={!hasContent}
              onClick={onGenerateSummary}
            />
          }
          value={formData.excerpt}
          onChange={(event) => onExcerptChange(event.target.value)}
        />
        <p className="text-sm text-[var(--muted)]">基于当前正文生成适合列表页与 SEO 展示的简短摘要。</p>
        {summaryError ? <p className="text-sm text-rose-500">{summaryError}</p> : null}
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor={`${mode}-post-seo-description`}>
          SEO 描述
        </label>
        <textarea
          id={`${mode}-post-seo-description`}
          className="ui-ring min-h-36 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          placeholder="搜索结果和分享卡片优先使用的描述"
          value={formData.seoDescription}
          onChange={(event) => onSeoDescriptionChange(event.target.value)}
        />
        <p className="text-sm text-[var(--muted)]">为空时前台元数据会继续回退到文章摘要。</p>
      </div>
    </div>
  );
}
