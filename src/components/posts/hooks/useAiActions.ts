"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { getApiErrorMessage } from "@/lib/admin-api-client";
import { generatePostSlug } from "@/lib/slug";

import type { PostFormData } from "./usePostForm";

type TaxonomyOption = {
  id: string;
  slug: string;
};

type AiMetadataSuggestion = {
  title?: string;
  slug?: string;
  excerpt?: string;
  categorySlug?: string | null;
  tagSlugs?: string[];
};

type AiArticleInfoSuggestion = {
  slug?: string;
  excerpt?: string;
  seoDescription?: string;
  categoryId?: string | null;
  tagIds?: string[];
};

type AiMetadataSingleField = "title" | "slug" | "category" | "tags";
export type AiMetadataField = "all" | AiMetadataSingleField;

type UseAiActionsOptions = {
  categories: TaxonomyOption[];
  formData: PostFormData;
  isSlugManuallyEdited: boolean;
  postId?: string;
  setFormData: Dispatch<SetStateAction<PostFormData>>;
  setIsSlugManuallyEdited: (value: boolean) => void;
  tags: TaxonomyOption[];
};

/**
 * Coordinates editor-side AI actions that mutate draft metadata.
 * Server routes still own model selection and validation; this hook only applies safe UI state updates.
 */
export function useAiActions({
  categories,
  formData,
  isSlugManuallyEdited,
  postId,
  setFormData,
  setIsSlugManuallyEdited,
  tags,
}: UseAiActionsOptions) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [metadataPendingField, setMetadataPendingField] = useState<AiMetadataField | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const isCompletingMetadata = metadataPendingField !== null;
  const isGeneratingAllMetadata = metadataPendingField === "all";

  const handleGenerateSummary = async () => {
    if (!formData.content.trim()) return;

    setIsSummarizing(true);
    setSummaryError("");

    try {
      const response = await fetch("/api/admin/posts/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: formData.title, content: formData.content }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "生成摘要失败");
      }

      setFormData((prev) => ({ ...prev, excerpt: String(data.data?.summary ?? "") }));
    } catch (summaryErrorValue) {
      setSummaryError(summaryErrorValue instanceof Error ? summaryErrorValue.message : "生成摘要失败");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateMetadata = async (field: AiMetadataSingleField) => {
    if (!formData.content.trim() && !(field === "slug" && formData.title.trim())) return;

    setMetadataPendingField(field);
    setMetadataError("");

    try {
      const response = await fetch("/api/admin/posts/metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, title: formData.title, content: formData.content }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "元信息补全失败");
      }

      const suggestion = (data.data ?? {}) as AiMetadataSuggestion;
      const nextCategoryId =
        typeof suggestion.categorySlug === "string"
          ? categories.find((category) => category.slug === suggestion.categorySlug)?.id
          : undefined;
      const nextTagIds = Array.isArray(suggestion.tagSlugs)
        ? suggestion.tagSlugs
            .map((slug) => tags.find((tag) => tag.slug === slug)?.id)
            .filter((id): id is string => Boolean(id))
        : undefined;

      setFormData((prev) => {
        const next = { ...prev };
        const suggestedTitle = suggestion.title?.trim();
        const suggestedSlug = suggestion.slug?.trim();

        if (field === "title" && suggestedTitle) {
          next.title = suggestedTitle;
          if (!isSlugManuallyEdited) {
            next.slug = suggestedSlug || generatePostSlug(suggestedTitle);
          }
        }

        if (field === "slug" && suggestedSlug) {
          next.slug = suggestedSlug;
        }

        if (field === "category" && nextCategoryId) {
          next.categoryId = nextCategoryId;
        }

        if (field === "tags" && nextTagIds && nextTagIds.length > 0) {
          next.tagIds = nextTagIds;
        }

        return next;
      });

      if (field === "slug" && suggestion.slug?.trim()) {
        setIsSlugManuallyEdited(true);
      }
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : "元信息补全失败");
    } finally {
      setMetadataPendingField(null);
    }
  };

  const handleGenerateAllArticleInfo = async () => {
    if (!formData.content.trim()) return;

    setMetadataPendingField("all");
    setMetadataError("");

    try {
      const response = await fetch("/api/admin/ai/actions/article-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          draft: {
            title: formData.title,
            slug: formData.slug,
            content: formData.content,
            excerpt: formData.excerpt,
            seoDescription: formData.seoDescription,
            categoryId: formData.categoryId,
            tagIds: formData.tagIds,
          },
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getApiErrorMessage(data, "一键 AI 生成失败"));
      }

      const suggestion = (data.data?.articleInfo ?? {}) as AiArticleInfoSuggestion;
      const suggestedSlug = suggestion.slug?.trim();
      const suggestedExcerpt = suggestion.excerpt?.trim();
      const seoDescription = suggestion.seoDescription?.trim() ?? "";
      const nextCategoryId = typeof suggestion.categoryId === "string" ? suggestion.categoryId : "";
      const nextTagIds = Array.isArray(suggestion.tagIds) ? suggestion.tagIds : [];

      if (!suggestedSlug || !suggestedExcerpt || !seoDescription) {
        throw new Error("AI 返回的信息不完整");
      }

      setFormData((prev) => ({
        ...prev,
        slug: generatePostSlug(suggestedSlug),
        excerpt: suggestedExcerpt,
        seoDescription,
        categoryId: nextCategoryId,
        tagIds: nextTagIds,
      }));
      setIsSlugManuallyEdited(true);
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : "元信息补全失败");
    } finally {
      setMetadataPendingField(null);
    }
  };

  return {
    handleGenerateAllArticleInfo,
    handleGenerateMetadata,
    handleGenerateSummary,
    isCompletingMetadata,
    isGeneratingAllMetadata,
    isSummarizing,
    metadataError,
    metadataPendingField,
    summaryError,
  };
}
