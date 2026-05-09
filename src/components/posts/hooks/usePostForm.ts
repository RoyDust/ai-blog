"use client";

import { useEffect, useMemo, useState } from "react";

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
  published: boolean;
  featured: boolean;
};

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
    coverAssetId: typeof data.coverAssetId === "string" ? data.coverAssetId : "",
    published: data.published === true,
    featured: data.featured === true,
  };
}

type UsePostFormOptions = {
  onDraftLoaded?: (draft: PostFormData) => void;
};

/**
 * Owns article form state plus create-mode local draft persistence.
 * Edit-mode loading stays in AdminPostWorkspace because it depends on the route post id.
 */
export function usePostForm(mode: "create" | "edit", draftKey: string | null, options: UsePostFormOptions = {}) {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [formData, setFormData] = useState<PostFormData>(emptyFormData);
  const { onDraftLoaded } = options;

  const canSubmit = useMemo(
    () => formData.title.trim().length > 0 && formData.slug.trim().length > 0 && formData.content.trim().length > 0,
    [formData],
  );

  useEffect(() => {
    if (mode !== "create" || !draftKey) return;

    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    let timer: number | null = null;

    try {
      const parsed = normalizeDraft(JSON.parse(raw));
      timer = window.setTimeout(() => {
        setFormData(parsed);
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
  }, [draftKey, mode, onDraftLoaded]);

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
