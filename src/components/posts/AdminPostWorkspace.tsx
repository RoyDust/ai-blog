"use client";

/**
 * 后台文章工作台主组件。
 *
 * 职责：
 * - 承载文章创建与编辑两种模式
 * - 协调编辑器、AI 辅助、封面管理、发布检查等多个子面板
 * - 管理本地草稿恢复、slug 自动生成、封面上传、保存状态等复杂交互
 *
 * 结构（2026-08 拆分）：
 * - WorkspaceHeader：顶栏（返回/标题/提交动作）
 * - PublishSettingsPanel：「发布设置」面板内容
 * - MetadataEditor：「分类、标签与封面图」面板内容
 * - ArticleInfoPreviewModal：一键 AI 生成结果确认弹窗
 * - AiFieldButton：字段级 AI 动作按钮（编辑器右侧槽位复用）
 * 主组件只保留状态编排、数据拉取与布局装配。
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { PostAiWorkspace } from "@/components/admin/ai/PostAiWorkspace";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Modal } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";

import { AiFieldButton } from "./AiFieldButton";
import { ArticleInfoPreviewModal } from "./ArticleInfoPreviewModal";
import { EditorWorkspace } from "./EditorWorkspace";
import { useAiActions } from "./hooks/useAiActions";
import { useCoverUpload } from "./hooks/useCoverUpload";
import { usePostForm } from "./hooks/usePostForm";
import { useSlugDerive } from "./hooks/useSlugDerive";
import { MetadataEditor } from "./MetadataEditor";
import { PublishChecklist } from "./PublishChecklist";
import { PublishSettingsPanel } from "./PublishSettingsPanel";
import { WorkspaceHeader } from "./WorkspaceHeader";
import type { CategoryOption, SeriesOption, TagOption, WorkspaceMode } from "./workspace-types";

type PostTag = {
  id: string;
  name: string;
  slug: string;
};

type AdminPostWorkspaceProps = {
  mode: WorkspaceMode;
  postId?: string;
};

type ApiListResponse<T> = {
  success?: boolean;
  data?: T[];
};

type AdminPostResponse = {
  success?: boolean;
  data?: {
    id?: string;
    title?: string | null;
    slug?: string | null;
    content?: string | null;
    excerpt?: string | null;
    seoDescription?: string | null;
    coverImage?: string | null;
    coverAssetId?: string | null;
    categoryId?: string | null;
    tags?: PostTag[];
    seriesId?: string | null;
    seriesOrder?: number | null;
    scheduledAt?: string | Date | null;
    published?: boolean | null;
    featured?: boolean | null;
  };
};

type SavePostResponse = {
  success?: boolean;
  data?: {
    id?: string | null;
    slug?: string | null;
    published?: boolean | null;
  };
};

/**
 * 根据文章当前状态决定保存成功后的跳转目标。
 * - 已发布：优先跳到前台文章页
 * - 未发布：回到后台编辑页
 * - 缺少关键标识：回退到文章列表
 */
function resolvePostRoute(
  post: { id?: string | null; slug?: string | null; published?: boolean | null },
  fallbackId: string | undefined,
  fallbackSlug: string,
) {
  if (post.published) {
    return `/posts/${post.slug ?? fallbackSlug}`;
  }

  if (post.id || fallbackId) {
    return `/admin/posts/${post.id ?? fallbackId}/edit`;
  }

  return "/admin/posts";
}

function toDateTimeLocalValue(value: string | Date | null | undefined) {
  if (!value) return "";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

/**
 * 后台文章编辑工作台。
 *
 * 输入：
 * - mode: create / edit
 * - postId: 编辑模式下的文章 id
 *
 * 主要副作用：
 * - 拉取分类、标签、文章详情
 * - 读写本地草稿
 * - 调用文章保存、封面上传、AI 摘要/元数据接口
 */
export function AdminPostWorkspace({ mode, postId }: AdminPostWorkspaceProps) {
  const router = useRouter();
  const isEditMode = mode === "edit";
  const canUseAiWorkspace = isEditMode ? Boolean(postId) : true;
  const draftKey = mode === "create" ? "author:draft:new" : null;

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [aiWorkspaceOpen, setAiWorkspaceOpen] = useState(false);
  const [hydratedPostId, setHydratedPostId] = useState<string | null>(null);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const {
    applySlugChange,
    applyTitleChange,
    isSlugManuallyEdited,
    setIsSlugManuallyEdited,
    syncSlugManualState,
  } = useSlugDerive();
  const { canSubmit, formData, saveStatus, setFormData } = usePostForm(mode, draftKey, {
    onDraftLoaded: syncSlugManualState,
  });
  const postDetailKey = isEditMode && postId ? `/api/admin/posts/${postId}` : null;
  const { data: categoriesPayload } = useSWR<ApiListResponse<CategoryOption>>("/api/categories", apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
  });
  const { data: tagsPayload } = useSWR<ApiListResponse<TagOption>>("/api/tags", apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
  });
  const { data: seriesPayload } = useSWR<ApiListResponse<SeriesOption>>("/api/admin/series", apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
  });
  const {
    data: postPayload,
    error: postLoadError,
    isLoading: isPostLoading,
  } = useSWR<AdminPostResponse>(postDetailKey, apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
  });
  const categories = Array.isArray(categoriesPayload?.data) ? categoriesPayload.data : [];
  const tags = Array.isArray(tagsPayload?.data) ? tagsPayload.data : [];
  const series = Array.isArray(seriesPayload?.data) ? seriesPayload.data : [];
  const { coverFileInputRef, coverUploadError, handleCoverUpload, isCoverUploading } = useCoverUpload(({ coverAssetId, coverImage }) =>
    setFormData((prev) => ({ ...prev, coverImage, coverAssetId })),
  );
  const {
    applyArticleInfoPreview,
    articleInfoPreview,
    dismissArticleInfoPreview,
    handleGenerateAllArticleInfo,
    handleGenerateMetadata,
    handleGenerateSummary,
    isCompletingMetadata,
    isGeneratingAllMetadata,
    isSummarizing,
    lastArticleInfoTaskId,
    metadataError,
    metadataPendingField,
    summaryError,
  } = useAiActions({
    categories,
    formData,
    isSlugManuallyEdited,
    postId: isEditMode ? postId : undefined,
    setFormData,
    setIsSlugManuallyEdited,
    tags,
  });

  const loadedPost = postPayload?.data;
  if (isEditMode && postId && loadedPost && hydratedPostId !== postId) {
    const loadedSeriesOrder =
      typeof loadedPost.seriesOrder === "number" && Number.isInteger(loadedPost.seriesOrder)
        ? loadedPost.seriesOrder
        : 0;

    setHydratedPostId(postId);
    setFormData({
      title: loadedPost.title ?? "",
      slug: loadedPost.slug ?? "",
      content: loadedPost.content ?? "",
      excerpt: loadedPost.excerpt ?? "",
      seoDescription: loadedPost.seoDescription ?? "",
      coverImage: loadedPost.coverImage ?? "",
      coverAssetId: loadedPost.coverAssetId ?? "",
      categoryId: loadedPost.categoryId ?? "",
      tagIds: Array.isArray(loadedPost.tags) ? loadedPost.tags.map((tag: PostTag) => tag.id) : [],
      seriesId: loadedPost.seriesId ?? "",
      seriesOrder: loadedSeriesOrder,
      scheduledAt: toDateTimeLocalValue(loadedPost.scheduledAt),
      published: Boolean(loadedPost.published),
      featured: Boolean(loadedPost.featured),
    });
    syncSlugManualState({
      title: loadedPost.title ?? "",
      slug: loadedPost.slug ?? "",
    });
  }

  /**
   * 统一处理“保存草稿”和“发布文章”两个提交意图。
   *
   * 通过 submitter.name/value 判断用户点击的按钮，再把最终 published 状态写入文章接口。
   * intent === "publish" 时先弹 ConfirmDialog 确认，确认后复用同一提交逻辑。
   */
  const performSubmit = async (intent: "publish" | "draft" | "schedule" | null) => {
    if (!canSubmit) return;

    setSaving(true);
    setError("");

    try {
      const scheduledAt = formData.scheduledAt.trim();

      if (intent === "schedule" && !scheduledAt) {
        throw new Error("请选择定时发布时间");
      }

      const published = intent === "publish" ? true : intent === "draft" || intent === "schedule" ? false : formData.published;
      const payload = {
        ...formData,
        published,
        scheduledAt: intent === "publish" || intent === "draft" ? null : scheduledAt || null,
      };
      const data = await apiMutate<SavePostResponse>(isEditMode ? `/api/admin/posts/${postId}` : "/api/admin/posts", {
        method: isEditMode ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });

      if (draftKey) {
        localStorage.removeItem(draftKey);
      }

      router.push(resolvePostRoute(data.data ?? {}, postId, payload.slug));
    } catch (submitError) {
      setError(toErrorMessage(submitError, isEditMode ? "保存失败" : "创建文章失败"));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    const nativeEvent = event.nativeEvent as unknown as { submitter?: HTMLElement | null };
    const submitter = nativeEvent.submitter;
    const intent: "publish" | "draft" | "schedule" | null =
      submitter instanceof HTMLButtonElement && submitter.getAttribute("name") === "intent"
        ? (submitter.value as "publish" | "draft" | "schedule")
        : null;

    // 无 submitter 的提交（如键盘 Enter）intent 为 null，此时若表单已被切到「已发布」，
    // 最终 published 仍为 true——同样必须走发布确认，不能绕过。
    const willPublish = intent === "publish" || (intent === null && formData.published === true);
    if (willPublish) {
      setPublishConfirmOpen(true);
      return;
    }

    await performSubmit(intent);
  };

  const confirmPublishSubmit = () => {
    void performSubmit("publish");
  };

  /**
   * AI 辅助工作区的输入桥接。
   *
   * 编辑模式直接绑定 postId；新建模式传入尚未落库的草稿字段，便于 AI 先生成可回填结果。
   */
  const aiWorkspace = canUseAiWorkspace ? (
    <PostAiWorkspace
      postId={isEditMode ? postId : undefined}
      draft={
        isEditMode
          ? undefined
          : {
              title: formData.title,
              slug: formData.slug,
              content: formData.content,
              excerpt: formData.excerpt,
              seoDescription: formData.seoDescription,
              categoryId: formData.categoryId,
              tagIds: formData.tagIds,
            }
      }
      disabled={!isEditMode && !formData.content.trim()}
      disabledMessage="填写正文后再运行 AI 动作。"
      onApplied={(post) =>
        setFormData((prev) => ({
          ...prev,
          title: post.title ?? prev.title,
          slug: post.slug ?? prev.slug,
          excerpt: post.excerpt ?? prev.excerpt,
          seoDescription: post.seoDescription ?? prev.seoDescription,
          categoryId: post.category?.id ?? prev.categoryId,
          tagIds: Array.isArray(post.tags) ? post.tags.map((tag) => tag.id) : prev.tagIds,
        }))
      }
    />
  ) : null;

  if (isEditMode && isPostLoading) {
    return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;
  }

  const visibleError = error || (postLoadError ? toErrorMessage(postLoadError, "加载失败") : "");
  const previewHref = formData.published && formData.slug.trim() ? `/posts/${formData.slug.trim()}` : null;
  const saveStatusLabel = isEditMode
    ? "手动保存"
    : saveStatus === "saving"
      ? "本地草稿保存中..."
      : saveStatus === "saved"
        ? "本地草稿已保存"
        : "本地草稿待保存";
  const hasContent = formData.content.trim() !== "";

  return (
    <form className="flex h-full min-h-0 flex-col gap-4 overflow-hidden" onSubmit={handleSubmit}>
      <WorkspaceHeader
        isEditMode={isEditMode}
        published={formData.published}
        saveStatusLabel={saveStatusLabel}
        saving={saving}
        canSubmit={canSubmit}
        previewHref={previewHref}
        scheduledAt={formData.scheduledAt}
        onBack={() => (isEditMode ? router.back() : router.push("/admin/posts"))}
      />

      {visibleError ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{visibleError}</p> : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[minmax(0,1fr)] xl:overflow-hidden">
        <EditorWorkspace
          className="h-full"
          fillHeight
          mode="content"
          contentMinRows={12}
          content={formData.content}
          coverImage={formData.coverImage}
          excerpt={formData.excerpt}
          slug={formData.slug}
          slugRightSlot={
            <AiFieldButton
              label="AI 补全 Slug"
              loading={metadataPendingField === "slug"}
              disabled={isCompletingMetadata || (!formData.title.trim() && !hasContent)}
              onClick={() => handleGenerateMetadata("slug")}
            />
          }
          title={formData.title}
          titleRightSlot={
            <AiFieldButton
              label="AI 补全标题"
              loading={metadataPendingField === "title"}
              disabled={isCompletingMetadata || !hasContent}
              onClick={() => handleGenerateMetadata("title")}
            />
          }
          onContentChange={(value) => setFormData((prev) => ({ ...prev, content: value }))}
          onCoverImageChange={(value) => setFormData((prev) => ({ ...prev, coverImage: value, coverAssetId: "" }))}
          onExcerptChange={(value) => setFormData((prev) => ({ ...prev, excerpt: value }))}
          onSlugChange={(value) => applySlugChange(value, setFormData)}
          onTitleChange={(value) => applyTitleChange(value, setFormData)}
        />

        <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1 xl:h-full xl:max-h-full">
          <WorkspacePanel title="发布设置" description="保存、发布和前台展示相关设置。" className="rounded-2xl" fillHeight={false}>
            <PublishSettingsPanel
              isEditMode={isEditMode}
              saveStatusLabel={saveStatusLabel}
              published={formData.published}
              featured={formData.featured}
              scheduledAt={formData.scheduledAt}
              slug={formData.slug}
              categoryId={formData.categoryId}
              tagCount={formData.tagIds.length}
              seriesId={formData.seriesId}
              coverImage={formData.coverImage}
              categories={categories}
              series={series}
              onKeepDraft={() => setFormData((prev) => ({ ...prev, published: false, scheduledAt: "" }))}
              onSwitchPublished={() => setFormData((prev) => ({ ...prev, published: true, scheduledAt: "" }))}
              onUnfeature={() => setFormData((prev) => ({ ...prev, featured: false }))}
              onFeature={() => setFormData((prev) => ({ ...prev, featured: true }))}
              onScheduledAtChange={(value) => setFormData((prev) => ({ ...prev, scheduledAt: value, published: false }))}
            />
          </WorkspacePanel>

          <WorkspacePanel title="发布清单" description="发布前检查标题、正文、SEO 与封面。" className="rounded-2xl" fillHeight={false}>
            <PublishChecklist
              variant="inline"
              content={formData.content}
              coverImage={formData.coverImage}
              excerpt={formData.excerpt}
              seoDescription={formData.seoDescription}
              slug={formData.slug}
              title={formData.title}
            />
          </WorkspacePanel>

          <WorkspacePanel title="分类、标签与封面图" description="这些字段会随保存或发布提交。" className="rounded-2xl" fillHeight={false}>
            <MetadataEditor
              mode={mode}
              formData={formData}
              hasContent={hasContent}
              canUseAiWorkspace={canUseAiWorkspace}
              categories={categories}
              tags={tags}
              series={series}
              metadataError={metadataError}
              metadataPendingField={metadataPendingField}
              isCompletingMetadata={isCompletingMetadata}
              isGeneratingAllMetadata={isGeneratingAllMetadata}
              lastArticleInfoTaskId={lastArticleInfoTaskId}
              isSummarizing={isSummarizing}
              summaryError={summaryError}
              coverUploadError={coverUploadError}
              isCoverUploading={isCoverUploading}
              coverInputRef={coverFileInputRef}
              onGenerateAll={() => void handleGenerateAllArticleInfo()}
              onOpenAiWorkspace={() => setAiWorkspaceOpen(true)}
              onGenerateMetadata={handleGenerateMetadata}
              onGenerateSummary={() => void handleGenerateSummary()}
              onCategoryChange={(value) => setFormData((prev) => ({ ...prev, categoryId: value }))}
              onTagToggle={(tagId, checked) =>
                setFormData((prev) => ({
                  ...prev,
                  tagIds: checked ? [...prev.tagIds, tagId] : prev.tagIds.filter((id) => id !== tagId),
                }))
              }
              onSeriesChange={(value) => setFormData((prev) => ({ ...prev, seriesId: value }))}
              onSeriesOrderChange={(value) => setFormData((prev) => ({ ...prev, seriesOrder: value }))}
              onCoverUrlChange={(value) => setFormData((prev) => ({ ...prev, coverImage: value, coverAssetId: "" }))}
              onCoverUpload={handleCoverUpload}
              onCoverUploadClick={() => coverFileInputRef.current?.click()}
              onCoverAssetSelect={(asset) => setFormData((prev) => ({ ...prev, coverImage: asset.url, coverAssetId: asset.id }))}
              onExcerptChange={(value) => setFormData((prev) => ({ ...prev, excerpt: value }))}
              onSeoDescriptionChange={(value) => setFormData((prev) => ({ ...prev, seoDescription: value }))}
            />
          </WorkspacePanel>
        </aside>
      </div>

      {canUseAiWorkspace ? (
        <Modal
          isOpen={aiWorkspaceOpen}
          onClose={() => setAiWorkspaceOpen(false)}
          title="AI 辅助"
          size="3xl"
          contentClassName="px-4 py-4 sm:px-6"
        >
          {aiWorkspace}
        </Modal>
      ) : null}

      {articleInfoPreview ? (
        <ArticleInfoPreviewModal
          preview={articleInfoPreview}
          categories={categories}
          tags={tags}
          onClose={dismissArticleInfoPreview}
          onApply={applyArticleInfoPreview}
        />
      ) : null}

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认发布"
        description="发布后立即对读者可见。"
        onConfirm={confirmPublishSubmit}
        onOpenChange={setPublishConfirmOpen}
        open={publishConfirmOpen}
        submitting={saving}
        title="确认发布文章"
      />
    </form>
  );
}
