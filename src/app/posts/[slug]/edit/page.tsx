"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import { z } from "zod";
import { EditorWorkspace, PublishChecklist } from "@/components/posts";
import { Button } from "@/components/admin/ui";
import { FadeBanner, InlineSpinner } from "@/components/admin/workspace/WorkspaceKit";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";

const postFormSchema = z.object({
  title: z.string().refine((value) => value.trim().length > 0, "请输入标题"),
  slug: z.string().refine((value) => value.trim().length > 0, "请输入 Slug"),
  content: z.string().refine((value) => value.trim().length > 0, "请输入正文"),
  excerpt: z.string(),
  coverImage: z.string(),
  published: z.boolean(),
});

type PostFormValues = z.infer<typeof postFormSchema>;

interface PostResponse {
  success?: boolean;
  data?: Partial<PostFormValues>;
}

const emptyPost: PostFormValues = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  coverImage: "",
  published: false,
};

function normalizePost(post?: Partial<PostFormValues> | null): PostFormValues {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    content: post?.content ?? "",
    excerpt: post?.excerpt ?? "",
    coverImage: post?.coverImage ?? "",
    published: Boolean(post?.published),
  };
}

function readDraft(draftKey: string, fallback: PostFormValues) {
  try {
    const localDraft = localStorage.getItem(draftKey);
    return localDraft ? normalizePost(JSON.parse(localDraft) as Partial<PostFormValues>) : fallback;
  } catch {
    return fallback;
  }
}

export default function EditPostPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const [routeSlug, setRouteSlug] = useState(() => ("slug" in params ? params.slug : ""));
  const hydratedDraftKeyRef = useRef<string | null>(null);
  const form = useForm<PostFormValues>({
    resolver: zodResolver(postFormSchema),
    defaultValues: emptyPost,
  });
  const draftKey = useMemo(() => `author:draft:edit:${routeSlug}`, [routeSlug]);
  const postUrl = useMemo(() => (routeSlug ? `/api/posts/${routeSlug}` : null), [routeSlug]);
  const {
    data: postResponse,
    error: loadError,
    isLoading: fetching,
  } = useSWR<PostResponse>(postUrl, apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
  });
  const formData = useWatch({ control: form.control }) as PostFormValues;

  useEffect(() => {
    let alive = true;

    Promise.resolve(params).then((resolvedParams) => {
      if (alive) {
        setRouteSlug(resolvedParams.slug);
      }
    });

    return () => {
      alive = false;
    };
  }, [params]);

  useEffect(() => {
    if (!postResponse?.data || hydratedDraftKeyRef.current === draftKey) return;

    const nextPost = normalizePost(postResponse.data);
    form.reset(readDraft(draftKey, nextPost));
    hydratedDraftKeyRef.current = draftKey;
  }, [draftKey, form, postResponse?.data]);

  useEffect(() => {
    if (hydratedDraftKeyRef.current !== draftKey) return;

    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [draftKey, formData]);

  const updateTextField = (key: "title" | "slug" | "content" | "excerpt" | "coverImage", value: string) => {
    form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
  };

  const updatePublished = (value: boolean) => {
    form.setValue("published", value, { shouldDirty: true, shouldValidate: true });
  };

  const handleSubmit = async (values: PostFormValues) => {
    setSubmitError("");

    try {
      await apiMutate(`/api/posts/${routeSlug}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      localStorage.removeItem(draftKey);
      router.push(`/posts/${values.slug}`);
    } catch (err) {
      setSubmitError(toErrorMessage(err, "保存失败，请稍后重试"));
    }
  };

  const validationErrors = [
    form.formState.errors.title?.message,
    form.formState.errors.slug?.message,
    form.formState.errors.content?.message,
  ].filter(Boolean);
  const error = submitError || (loadError ? toErrorMessage(loadError, "加载失败") : "");

  if (!routeSlug || (fetching && !postResponse)) {
    return (
      <p role="status" className="flex items-center gap-2 px-4 py-10 text-sm text-[var(--text-muted)]">
        <InlineSpinner />
        正在加载编辑器...
      </p>
    );
  }

  return (
    <form className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-6 sm:px-6" noValidate onSubmit={form.handleSubmit(handleSubmit)}>
      <header className="border-b-2 border-[var(--foreground)] pb-3">
        <p className="ed-eyebrow">写作</p>
        <h1 className="font-serif text-[1.75rem] leading-[1.2] font-bold text-[var(--foreground)]">编辑文章</h1>
        <p className="mt-1 text-sm text-[var(--text-body)]">你正在编辑：{formData.title || routeSlug}</p>
      </header>
      <FadeBanner message={error} tone="danger" />
      <FadeBanner
        tone="danger"
        message={
          validationErrors.length > 0 ? (
            <>
              {validationErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </>
          ) : null
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <EditorWorkspace
          content={formData.content}
          coverImage={formData.coverImage}
          excerpt={formData.excerpt}
          slug={formData.slug}
          title={formData.title}
          onContentChange={(value) => updateTextField("content", value)}
          onCoverImageChange={(value) => updateTextField("coverImage", value)}
          onExcerptChange={(value) => updateTextField("excerpt", value)}
          onSlugChange={(value) => updateTextField("slug", value)}
          onTitleChange={(value) => updateTextField("title", value)}
        />

        <aside className="flex flex-col gap-5 border-t border-[var(--border)] pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
          <PublishChecklist content={formData.content} coverImage={formData.coverImage} slug={formData.slug} title={formData.title} />
          <section className="border-t border-[var(--reader-border-strong)] pt-4">
            <label className="mb-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input
                checked={formData.published}
                className="ed-checkbox"
                onChange={(e) => updatePublished(e.target.checked)}
                type="checkbox"
              />
              发布文章
            </label>
            <div className="flex flex-col gap-2">
              <Button disabled={form.formState.isSubmitting} type="submit">
                {form.formState.isSubmitting ? "保存中..." : "保存修改"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                取消
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
