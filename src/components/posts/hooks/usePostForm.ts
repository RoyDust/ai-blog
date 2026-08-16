"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export type PostFormData = {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  seoDescription: string;
  coverImage: string;
  coverAssetId: string;
  categoryId: string;
  tagIds: string[];
  seriesId: string;
  seriesOrder: number;
  scheduledAt: string;
  published: boolean;
  featured: boolean;
};

const postFormSchema = z.object({
  // title/slug/content 与服务端 parsePostInput 的必填规则对齐（canSubmit 同时门禁提交）
  title: z.string().min(1, "标题不能为空"),
  slug: z.string().min(1, "slug 不能为空"),
  content: z.string().min(1, "内容不能为空"),
  excerpt: z.string(),
  seoDescription: z.string(),
  coverImage: z.string(),
  coverAssetId: z.string(),
  categoryId: z.string(),
  tagIds: z.array(z.string()),
  seriesId: z.string(),
  seriesOrder: z.number(),
  scheduledAt: z.string(),
  published: z.boolean(),
  featured: z.boolean(),
});

export const emptyFormData: PostFormData = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  seoDescription: "",
  coverImage: "",
  coverAssetId: "",
  categoryId: "",
  tagIds: [],
  seriesId: "",
  seriesOrder: 0,
  scheduledAt: "",
  published: false,
  featured: false,
};

/**
 * Restores persisted editor drafts into the current form schema.
 * Older or malformed localStorage values are normalized instead of trusted.
 */
function normalizeDraft(payload: unknown): PostFormData {
  const data = (payload ?? {}) as Partial<PostFormData>;

  return {
    ...emptyFormData,
    ...data,
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    tagIds: Array.isArray(data.tagIds) ? data.tagIds.filter((tagId): tagId is string => typeof tagId === "string") : [],
    seriesId: typeof data.seriesId === "string" ? data.seriesId : "",
    seriesOrder: typeof data.seriesOrder === "number" && Number.isInteger(data.seriesOrder) && data.seriesOrder >= 0 ? data.seriesOrder : 0,
    scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : "",
    coverAssetId: typeof data.coverAssetId === "string" ? data.coverAssetId : "",
    published: data.published === true,
    featured: data.featured === true,
  };
}

type UsePostFormOptions = {
  onDraftLoaded?: (draft: PostFormData) => void;
};

type SetFormDataArg = PostFormData | ((prev: PostFormData) => PostFormData);

/**
 * Owns article form state plus create-mode local draft persistence.
 *
 * 实现：React Hook Form + Zod 作为唯一数据源。`formData` 由 `useWatch`
 * 派生；`setFormData` 兼容函数式更新（getValues + reset 包装），消费方
 * AdminPostWorkspace 的全部调用点无需改动。草稿恢复与 450ms 防抖保存语义保留。
 */
export function usePostForm(mode: "create" | "edit", draftKey: string | null, options: UsePostFormOptions = {}) {
  const methods = useForm<PostFormData>({
    resolver: zodResolver(postFormSchema),
    defaultValues: emptyFormData,
  });
  const { control, getValues, reset } = methods;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const { onDraftLoaded } = options;

  const formData = useWatch({ control }) as PostFormData;

  const canSubmit = useMemo(
    () => formData.title.trim().length > 0 && formData.slug.trim().length > 0 && formData.content.trim().length > 0,
    [formData],
  );

  // 注意：setFormData 必须保持引用稳定——消费方 AdminPostWorkspace 的编辑加载
  // effect 依赖它，身份变化会导致加载 effect 反复重跑。getValues/reset 由 RHF
  // 内部 useCallback 稳定。
  const setFormData = useCallback(
    (updater: SetFormDataArg) => {
      const prev = getValues();
      const next = typeof updater === "function" ? updater(prev) : updater;
      reset(next);
    },
    [getValues, reset],
  );

  useEffect(() => {
    if (mode !== "create" || !draftKey) return;

    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    let timer: number | null = null;

    try {
      const parsed = normalizeDraft(JSON.parse(raw));
      timer = window.setTimeout(() => {
        reset(parsed);
        onDraftLoaded?.(parsed);
      }, 0);
    } catch {
      localStorage.removeItem(draftKey);
    }

    return () => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [draftKey, mode, onDraftLoaded, reset]);

  useEffect(() => {
    if (mode !== "create" || !draftKey) return;

    const statusTimer = window.setTimeout(() => setSaveStatus("saving"), 0);
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(formData));
      setSaveStatus("saved");
    }, 450);

    return () => {
      window.clearTimeout(statusTimer);
      window.clearTimeout(timer);
    };
  }, [draftKey, formData, mode]);

  return {
    canSubmit,
    formData,
    saveStatus,
    setFormData,
  };
}
