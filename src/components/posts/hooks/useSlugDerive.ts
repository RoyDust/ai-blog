"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import { generatePostSlug } from "@/lib/slug";

import type { PostFormData } from "./usePostForm";

type SetPostFormData = Dispatch<SetStateAction<PostFormData>>;

export function useSlugDerive() {
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const syncSlugManualState = useCallback((post: Pick<PostFormData, "title" | "slug">) => {
    setIsSlugManuallyEdited(Boolean(post.slug) && post.slug !== generatePostSlug(post.title));
  }, []);

  const applyTitleChange = useCallback(
    (value: string, setFormData: SetPostFormData) => {
      setFormData((prev) => ({
        ...prev,
        title: value,
        slug: isSlugManuallyEdited ? prev.slug : generatePostSlug(value),
      }));
    },
    [isSlugManuallyEdited],
  );

  const applySlugChange = useCallback((value: string, setFormData: SetPostFormData) => {
    setIsSlugManuallyEdited(true);
    setFormData((prev) => ({ ...prev, slug: value }));
  }, []);

  return {
    applySlugChange,
    applyTitleChange,
    isSlugManuallyEdited,
    setIsSlugManuallyEdited,
    syncSlugManualState,
  };
}
