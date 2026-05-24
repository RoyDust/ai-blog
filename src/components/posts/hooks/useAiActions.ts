"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";

import { getApiErrorMessage } from "@/lib/admin-api-client";
import { generatePostSlug } from "@/lib/slug";

import type { PostFormData } from "./usePostForm";

type TaxonomyOption = {
  id: string;
  slug: string;
};

type AiArticleInfoSuggestion = {
  slug?: string;
  excerpt?: string;
  seoDescription?: string;
  categoryId?: string | null;
  tagIds?: string[];
};

type AiArticleInfoField = "slug" | "excerpt" | "seoDescription" | "categoryId" | "tagIds";

type AiArticleInfoQuality = {
  score?: number;
  blockedFields?: string[];
  checks?: Array<{
    key?: string;
    label?: string;
    status?: "ok" | "warning" | "danger";
    message?: string;
  }>;
};

export type AiArticleInfoPreview = {
  taskId: string;
  taskHref: string;
  suggestion: AiArticleInfoSuggestion;
  fields: Record<AiArticleInfoField, boolean>;
  original: Pick<PostFormData, "slug" | "excerpt" | "seoDescription" | "categoryId" | "tagIds">;
  failures: Array<{ action: string; message: string }>;
  partial: boolean;
  quality: AiArticleInfoQuality | null;
  metrics: Array<{ action: string; durationMs: number; modelId: string | null }>;
};

type AiArticleInfoItem = {
  action?: unknown;
  output?: unknown;
};

const articleInfoActionLabels: Record<string, string> = {
  slug: "Slug",
  summary: "摘要",
  "seo-description": "SEO 描述",
  category: "分类",
  tags: "标签",
};

const ONE_CLICK_MIN_CONTENT_CHARS = 20;
const ARTICLE_INFO_CACHE_MS = 60_000;

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

function readObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function buildArticleInfoSuggestionFromItems(items: AiArticleInfoItem[]): AiArticleInfoSuggestion {
  const suggestion: AiArticleInfoSuggestion = {};

  for (const item of items) {
    const output = readObject(item.output);

    if (item.action === "slug") {
      const slug = readString(output.slug);
      if (slug) suggestion.slug = slug;
    }

    if (item.action === "summary") {
      const excerpt = readString(output.summary);
      if (excerpt) suggestion.excerpt = excerpt;
    }

    if (item.action === "seo-description") {
      const seoDescription = readString(output.seoDescription);
      if (seoDescription) suggestion.seoDescription = seoDescription;
    }

    if (item.action === "category") {
      const categoryId = readString(output.categoryId);
      if (categoryId) suggestion.categoryId = categoryId;
    }

    if (item.action === "tags") {
      const tagIds = readStringList(output.existingTagIds);
      if (tagIds.length > 0) suggestion.tagIds = tagIds;
    }
  }

  return suggestion;
}

function readQuality(value: unknown): AiArticleInfoQuality | null {
  const quality = readObject(value);
  if (Object.keys(quality).length === 0) return null;

  return {
    score: typeof quality.score === "number" ? quality.score : undefined,
    blockedFields: readStringList(quality.blockedFields),
    checks: Array.isArray(quality.checks)
      ? quality.checks.map((check) => {
          const item = readObject(check);
          const status = item.status === "ok" || item.status === "warning" || item.status === "danger" ? item.status : undefined;
          return {
            key: readString(item.key),
            label: readString(item.label),
            status,
            message: readString(item.message),
          };
        })
      : [],
  };
}

function getMeaningfulContentLength(content: string) {
  return content.replace(/[#*_`>\-[\]()\s，。！？、,.!?]/g, "").trim().length;
}

function buildDraftPayload(formData: PostFormData) {
  return {
    title: formData.title,
    slug: formData.slug,
    content: formData.content,
    excerpt: formData.excerpt,
    seoDescription: formData.seoDescription,
    categoryId: formData.categoryId,
    tagIds: formData.tagIds,
  };
}

function buildArticleInfoCacheKey(postId: string | undefined, formData: PostFormData) {
  return JSON.stringify({
    postId: postId ?? null,
    title: formData.title,
    slug: formData.slug,
    content: formData.content,
    excerpt: formData.excerpt,
    seoDescription: formData.seoDescription,
    categoryId: formData.categoryId,
    tagIds: formData.tagIds,
  });
}

function hasBlockedField(quality: AiArticleInfoQuality | null, field: string) {
  return Boolean(quality?.blockedFields?.includes(field));
}

function getArticleInfoFields(suggestion: AiArticleInfoSuggestion, quality: AiArticleInfoQuality | null): Record<AiArticleInfoField, boolean> {
  return {
    slug: Boolean(suggestion.slug?.trim()) && !hasBlockedField(quality, "slug"),
    excerpt: Boolean(suggestion.excerpt?.trim()),
    seoDescription: Boolean(suggestion.seoDescription?.trim()),
    categoryId: typeof suggestion.categoryId === "string" && suggestion.categoryId.trim().length > 0,
    tagIds: Array.isArray(suggestion.tagIds) && suggestion.tagIds.length > 0,
  };
}

function getArticleInfoFieldCount(fields: Record<AiArticleInfoField, boolean>) {
  return Object.values(fields).filter(Boolean).length;
}

function normalizeArticleInfoPreview({
  data,
  formData,
}: {
  data: unknown;
  formData: PostFormData;
}): AiArticleInfoPreview {
  const payload = readObject(data);
  const responseData = readObject(payload.data);
  const items = Array.isArray(responseData.items) ? (responseData.items as AiArticleInfoItem[]) : [];
  const articleInfo = readObject(responseData.articleInfo);
  const suggestion = (Object.keys(articleInfo).length > 0 ? articleInfo : buildArticleInfoSuggestionFromItems(items)) as AiArticleInfoSuggestion;
  const quality = readQuality(responseData.quality);
  const fields = getArticleInfoFields(suggestion, quality);
  const taskId = readString(responseData.taskId);
  const failures = Array.isArray(responseData.failures)
    ? responseData.failures.map((failure) => {
        const item = readObject(failure);
        return { action: readString(item.action), message: readString(item.message) };
      })
    : [];
  const metrics = items.map((item) => {
    const outputMeta = readObject(readObject(item.output)._meta);
    return {
      action: readString(item.action),
      durationMs: typeof outputMeta.durationMs === "number" ? outputMeta.durationMs : 0,
      modelId: typeof outputMeta.modelId === "string" ? outputMeta.modelId : null,
    };
  });

  return {
    taskId,
    taskHref: taskId ? `/admin/ai/tasks/${taskId}` : "/admin/ai/tasks",
    suggestion,
    fields,
    original: {
      slug: formData.slug,
      excerpt: formData.excerpt,
      seoDescription: formData.seoDescription,
      categoryId: formData.categoryId,
      tagIds: formData.tagIds,
    },
    failures,
    partial: responseData.partial === true || failures.length > 0,
    quality,
    metrics,
  };
}

function getArticleInfoFailureMessage(data: unknown, fallback: string) {
  const payload = readObject(data);
  const responseData = readObject(payload.data);
  const failures = Array.isArray(responseData.failures) ? responseData.failures : [];
  const labels = failures
    .map((failure) => {
      const action = readString(readObject(failure).action);
      return articleInfoActionLabels[action] ?? action;
    })
    .filter(Boolean);

  if (labels.length > 0) {
    return `部分字段生成失败：${labels.join("、")}。请确认预览后应用其他可用结果。`;
  }

  return fallback;
}

/**
 * Coordinates editor-side AI actions that mutate draft metadata.
 * Server routes still own model selection and validation; this hook only applies safe UI state updates.
 */
export function useAiActions({
  formData,
  isSlugManuallyEdited,
  postId,
  setFormData,
  setIsSlugManuallyEdited,
}: UseAiActionsOptions) {
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [metadataPendingField, setMetadataPendingField] = useState<AiMetadataField | null>(null);
  const [metadataError, setMetadataError] = useState("");
  const [articleInfoPreview, setArticleInfoPreview] = useState<AiArticleInfoPreview | null>(null);
  const [lastArticleInfoTaskId, setLastArticleInfoTaskId] = useState("");
  const articleInfoCacheRef = useRef<{ key: string; createdAt: number; preview: AiArticleInfoPreview } | null>(null);
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
      const response = await fetch("/api/admin/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          draft: buildDraftPayload(formData),
          action: field,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "元信息补全失败");
      }

      const output = readObject(data.data?.output);
      const outputMeta = readObject(output._meta);
      const quality = readQuality(outputMeta.quality);
      const nextCategoryId = typeof output.categoryId === "string" && output.categoryId ? output.categoryId : undefined;
      const nextTagIds = readStringList(output.existingTagIds);

      setFormData((prev) => {
        const next = { ...prev };
        const suggestedTitle = readStringList(output.titles)[0]?.trim();
        const suggestedSlug = readString(output.slug);

        if (field === "title" && suggestedTitle) {
          next.title = suggestedTitle;
          if (!isSlugManuallyEdited) {
            next.slug = suggestedSlug || generatePostSlug(suggestedTitle);
          }
        }

        if (field === "slug" && suggestedSlug && !hasBlockedField(quality, "slug")) {
          next.slug = suggestedSlug;
        }

        if (field === "category" && nextCategoryId) {
          next.categoryId = nextCategoryId;
        }

        if (field === "tags" && nextTagIds.length > 0) {
          next.tagIds = nextTagIds;
        }

        return next;
      });

      if (field === "slug" && readString(output.slug) && !hasBlockedField(quality, "slug")) {
        setIsSlugManuallyEdited(true);
      }

      if (field === "slug" && hasBlockedField(quality, "slug")) {
        setMetadataError(quality?.checks?.find((check) => check.key === "slug-unique")?.message || "Slug 已存在，已保留当前值");
      }
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : "元信息补全失败");
    } finally {
      setMetadataPendingField(null);
    }
  };

  const handleGenerateAllArticleInfo = async () => {
    if (!formData.content.trim()) return;

    if (getMeaningfulContentLength(formData.content) < ONE_CLICK_MIN_CONTENT_CHARS) {
      setMetadataError(`正文至少需要 ${ONE_CLICK_MIN_CONTENT_CHARS} 个有效字符后再使用一键 AI 生成`);
      return;
    }

    setMetadataPendingField("all");
    setMetadataError("");

    try {
      const cacheKey = buildArticleInfoCacheKey(postId, formData);
      const cached = articleInfoCacheRef.current;

      if (cached?.key === cacheKey && Date.now() - cached.createdAt < ARTICLE_INFO_CACHE_MS) {
        setArticleInfoPreview(cached.preview);
        setLastArticleInfoTaskId(cached.preview.taskId);
        setMetadataError("已复用最近一次 AI 生成结果，请确认预览后应用。");
        return;
      }

      const response = await fetch("/api/admin/ai/actions/article-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          draft: buildDraftPayload(formData),
        }),
      });
      const data = await response.json();
      const preview = normalizeArticleInfoPreview({ data, formData });
      const appliedFieldCount = getArticleInfoFieldCount(preview.fields);

      if (!response.ok || !data.success) {
        if (appliedFieldCount === 0) {
          throw new Error(getApiErrorMessage(data, "一键 AI 生成失败"));
        }
      } else if (!preview.fields.slug || !preview.fields.excerpt || !preview.fields.seoDescription) {
        throw new Error("AI 返回的信息不完整");
      }

      setArticleInfoPreview(preview);
      setLastArticleInfoTaskId(preview.taskId);
      articleInfoCacheRef.current = { key: cacheKey, createdAt: Date.now(), preview };

      if (!response.ok || !data.success) {
        setMetadataError(getArticleInfoFailureMessage(data, "部分字段生成失败，请确认预览后应用。"));
      }
    } catch (error) {
      setMetadataError(error instanceof Error ? error.message : "元信息补全失败");
    } finally {
      setMetadataPendingField(null);
    }
  };

  const applyArticleInfoPreview = () => {
    if (!articleInfoPreview) return;

    setFormData((prev) => {
      const next = { ...prev };
      const { fields, suggestion } = articleInfoPreview;

      if (fields.slug && suggestion.slug) next.slug = generatePostSlug(suggestion.slug);
      if (fields.excerpt && suggestion.excerpt) next.excerpt = suggestion.excerpt;
      if (fields.seoDescription && suggestion.seoDescription) next.seoDescription = suggestion.seoDescription;
      if (fields.categoryId && typeof suggestion.categoryId === "string") next.categoryId = suggestion.categoryId;
      if (fields.tagIds && Array.isArray(suggestion.tagIds)) next.tagIds = suggestion.tagIds;

      return next;
    });

    if (articleInfoPreview.fields.slug) {
      setIsSlugManuallyEdited(true);
    }

    setArticleInfoPreview(null);
  };

  return {
    applyArticleInfoPreview,
    articleInfoPreview,
    dismissArticleInfoPreview: () => setArticleInfoPreview(null),
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
  };
}
