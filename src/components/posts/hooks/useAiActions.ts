"use client";

import { useState, type Dispatch, type SetStateAction } from "react";

import { generatePostSlug } from "@/lib/slug";

import type { PostFormData } from "./usePostForm";

type TaxonomyOption = {
  id: string;
  slug: string;
};

type AiMetadataSuggestion = {
  title?: string;
  slug?: string;
  categorySlug?: string | null;
  tagSlugs?: string[];
};

export type AiMetadataField = "title" | "slug" | "category" | "tags";

type UseAiActionsOptions = {
  categories: TaxonomyOption[];
  formData: PostFormData;
  isSlugManuallyEdited: boolean;
  setFormData: Dispatch<SetStateAction<PostFormData>>;
  setIsSlugManuallyEdited: (value: boolean) => void;
  tags: TaxonomyOption[];
};

export function useAiActions({
  categories,
  formData,
  isSlugManuallyEdited,
  setFormData,
  setIsSlugManuallyEdited,
  tags,
}: UseAiActionsOptions) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [metadataPendingField, setMetadataPendingField] = useState<AiMetadataField | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const isCompletingMetadata = metadataPendingField !== null;

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

  const handleGenerateMetadata = async (field: AiMetadataField) => {
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

  return {
    handleGenerateMetadata,
    handleGenerateSummary,
    isCompletingMetadata,
    isSummarizing,
    metadataError,
    metadataPendingField,
    summaryError,
  };
}
