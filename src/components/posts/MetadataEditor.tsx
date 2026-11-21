"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import type { ChangeEvent, RefObject } from "react";

import { CoverPicker } from "@/components/admin/covers/CoverPicker";
import type { CoverAsset } from "@/components/admin/covers/types";
import { Button } from "@/components/admin/ui";
import { FadeBanner, FieldLabel, FramedInput, InlineSpinner } from "@/components/admin/workspace/WorkspaceKit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { REUSED_ARTICLE_INFO_MESSAGE, type AiMetadataField, type AiMetadataSingleField } from "./hooks/useAiActions";
import type { PostFormData } from "./hooks/usePostForm";
import { AiFieldButton } from "./AiFieldButton";
import type { CategoryOption, SeriesOption, TagOption, WorkspaceMode } from "./workspace-types";

const uncategorizedValue = "__uncategorized__";
const noSeriesValue = "__no_series__";
const selectTriggerClassName = "w-full";
const hintClassName = "mt-1.5 text-xs leading-[1.55] text-[var(--text-muted)]";
const fieldErrorClassName = "mt-1.5 text-[0.8125rem] text-[var(--danger-foreground)]";

const AiCoverGenerator = dynamic(
  () => import("@/components/admin/covers/AiCoverGenerator").then((mod) => mod.AiCoverGenerator),
  {
    ssr: false,
    loading: () => (
      <Button type="button" size="sm" variant="outline" disabled>
        AI 生成封面
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
  const metadataBannerTone = metadataError === REUSED_ARTICLE_INFO_MESSAGE ? "info" : "danger";

  return (
    <div className="flex flex-col gap-4" data-slot="metadata-editor">
      <FadeBanner message={metadataError} tone={metadataBannerTone} className="text-[0.8125rem]" />

      <OneClickAiBlock
        hasContent={hasContent}
        canUseAiWorkspace={canUseAiWorkspace}
        isCompletingMetadata={isCompletingMetadata}
        isGeneratingAllMetadata={isGeneratingAllMetadata}
        lastArticleInfoTaskId={lastArticleInfoTaskId}
        onGenerateAll={onGenerateAll}
        onOpenAiWorkspace={onOpenAiWorkspace}
      />

      <div className="min-w-0">
        <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
          <FieldLabel htmlFor={`${mode}-post-category`}>分类</FieldLabel>
          <AiFieldButton
            placement="label"
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
          <SelectTrigger id={`${mode}-post-category`} className={selectTriggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={uncategorizedValue}>未分类</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5 flex min-h-5 items-center justify-between gap-3">
          <FieldLabel as="span" id={`${mode}-post-tags-label`} optional>
            标签
          </FieldLabel>
          <AiFieldButton
            placement="label"
            label="AI 选择标签"
            loading={metadataPendingField === "tags"}
            disabled={isCompletingMetadata || !hasContent}
            onClick={() => onGenerateMetadata("tags")}
          />
        </div>
        <div
          role="group"
          aria-labelledby={`${mode}-post-tags-label`}
          className="max-h-60 overflow-y-auto rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] px-2.5 py-[3px]"
        >
          {tags.length === 0 ? <p className="py-1.5 text-[0.8125rem] text-[var(--text-muted)]">暂无可选标签</p> : null}
          {tags.map((tag) => {
            const inputId = `${mode}-post-tag-${tag.id}`;
            const checked = formData.tagIds.includes(tag.id);

            return (
              <label
                key={tag.id}
                htmlFor={inputId}
                className="flex min-h-[30px] cursor-pointer items-center gap-2 text-[0.8125rem] text-[var(--text-body)] transition-colors duration-150 hover:text-[var(--foreground)]"
              >
                <input
                  id={inputId}
                  type="checkbox"
                  className="ed-checkbox"
                  checked={checked}
                  onChange={(event) => onTagToggle(tag.id, event.target.checked)}
                />
                {tag.name}
              </label>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-3">
        <div className="min-w-0">
          <div className="mb-1.5">
            <FieldLabel htmlFor={`${mode}-post-series`} optional>
              所属系列
            </FieldLabel>
          </div>
          <Select
            value={formData.seriesId || noSeriesValue}
            onValueChange={(value) => onSeriesChange(value === noSeriesValue ? "" : value)}
          >
            <SelectTrigger id={`${mode}-post-series`} className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noSeriesValue}>不归入系列</SelectItem>
              {series.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5">
            <FieldLabel htmlFor={`${mode}-post-series-order`}>系列排序</FieldLabel>
          </div>
          <FramedInput
            id={`${mode}-post-series-order`}
            min={0}
            type="number"
            inputClassName="font-mono"
            value={String(formData.seriesOrder)}
            onChange={(event) => onSeriesOrderChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))}
          />
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-1.5">
          <FieldLabel htmlFor={`${mode}-post-cover-url`} optional>
            封面图 URL
          </FieldLabel>
        </div>
        <FramedInput
          id={`${mode}-post-cover-url`}
          placeholder="https://example.com/cover.jpg"
          inputClassName="font-mono md:text-[0.8125rem]"
          value={formData.coverImage}
          onChange={(event) => onCoverUrlChange(event.target.value)}
        />
        <input ref={coverInputRef} accept="image/*" className="hidden" id={`${mode}-cover-upload`} type="file" onChange={onCoverUpload} />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-busy={isCoverUploading || undefined}
            onClick={onCoverUploadClick}
            disabled={isCoverUploading}
          >
            {isCoverUploading ? <InlineSpinner className="mr-0.5" /> : null}
            {isCoverUploading ? "上传中..." : "上传并保存到图库"}
          </Button>
          <CoverPicker selectedAssetId={formData.coverAssetId} onSelect={onCoverAssetSelect} />
          <AiCoverGenerator
            title={formData.title}
            excerpt={formData.excerpt}
            content={formData.content}
            onGenerated={onCoverAssetSelect}
          />
        </div>
        <p className={hintClassName}>选择图片后自动回填封面地址。</p>
        {coverUploadError ? (
          <p role="alert" className={fieldErrorClassName}>
            {coverUploadError}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5">
          <FieldLabel htmlFor={`${mode}-post-excerpt`} optional>
            摘要
          </FieldLabel>
        </div>
        <FramedInput
          id={`${mode}-post-excerpt`}
          placeholder="文章摘要（可选）"
          aria-describedby={`${mode}-post-excerpt-hint`}
          suffix={
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
        <p id={`${mode}-post-excerpt-hint`} className={hintClassName}>
          基于当前正文生成适合列表页与 SEO 展示的简短摘要。
        </p>
        {summaryError ? (
          <p role="alert" className={fieldErrorClassName}>
            {summaryError}
          </p>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="mb-1.5">
          <FieldLabel htmlFor={`${mode}-post-seo-description`} optional>
            SEO 描述
          </FieldLabel>
        </div>
        <textarea
          id={`${mode}-post-seo-description`}
          aria-describedby={`${mode}-post-seo-description-hint`}
          className="min-h-24 w-full resize-y rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent px-2.5 py-2 text-base leading-[1.65] text-[var(--foreground)] transition-[border-color] duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] md:text-sm"
          placeholder="搜索结果和分享卡片优先使用的描述"
          value={formData.seoDescription}
          onChange={(event) => onSeoDescriptionChange(event.target.value)}
        />
        <p id={`${mode}-post-seo-description-hint`} className={hintClassName}>
          为空时前台元数据会继续回退到文章摘要。
        </p>
      </div>
    </div>
  );
}

/** 「一键 AI 生成信息」：左侧 2px info 竖线的说明段 + 两个描边按钮 + 「查看最近 AI 任务」文字链接 */
function OneClickAiBlock({
  hasContent,
  canUseAiWorkspace,
  isCompletingMetadata,
  isGeneratingAllMetadata,
  lastArticleInfoTaskId,
  onGenerateAll,
  onOpenAiWorkspace,
}: Pick<
  MetadataEditorProps,
  | "hasContent"
  | "canUseAiWorkspace"
  | "isCompletingMetadata"
  | "isGeneratingAllMetadata"
  | "lastArticleInfoTaskId"
  | "onGenerateAll"
  | "onOpenAiWorkspace"
>) {
  return (
    <div className="border-l-2 border-[var(--focus)] py-0.5 pl-3" data-slot="one-click-ai">
      <p className="text-sm font-bold text-[var(--foreground)]">一键 AI 生成信息</p>
      <p className="mt-0.5 text-xs leading-[1.55] text-[var(--text-muted)]">保留标题和正文，覆盖 Slug、摘要、SEO、分类和标签。</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-busy={isGeneratingAllMetadata || undefined}
          disabled={isCompletingMetadata || !hasContent}
          onClick={onGenerateAll}
        >
          {isGeneratingAllMetadata ? <InlineSpinner className="mr-0.5" /> : null}
          {isGeneratingAllMetadata ? "生成中..." : "一键 AI 生成"}
        </Button>
        {canUseAiWorkspace ? (
          <Button type="button" size="sm" variant="outline" onClick={onOpenAiWorkspace}>
            打开 AI 辅助
          </Button>
        ) : null}
        {lastArticleInfoTaskId ? (
          <Link
            className="inline-flex min-h-8 items-center text-[0.8125rem] font-bold text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)]"
            href={`/admin/ai/tasks/${lastArticleInfoTaskId}`}
          >
            查看最近 AI 任务
          </Link>
        ) : null}
      </div>
    </div>
  );
}
