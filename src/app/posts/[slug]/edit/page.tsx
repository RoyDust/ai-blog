"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorWorkspace, PublishChecklist } from "@/components/posts";
import { Button } from "@/components/ui";

interface Post {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  coverImage: string;
  published: boolean;
}

export default function EditPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: routeSlug } = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<Post>({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    coverImage: "",
    published: false,
  });
  const draftKey = useMemo(() => `author:draft:edit:${routeSlug}`, [routeSlug]);

  useEffect(() => {
    let alive = true;
    async function loadPost() {
      setFetching(true);
      try {
        const response = await fetch(`/api/posts/${routeSlug}`);
        const data = await response.json();
        if (!alive) return;
        if (!data.success) {
          throw new Error("文章加载失败");
        }
        const next = {
          title: data.data.title ?? "",
          slug: data.data.slug ?? "",
          content: data.data.content ?? "",
          excerpt: data.data.excerpt ?? "",
          coverImage: data.data.coverImage ?? "",
          published: Boolean(data.data.published),
        };
        const localDraft = localStorage.getItem(draftKey);
        setFormData(localDraft ? (JSON.parse(localDraft) as Post) : next);
      } catch (err) {
        if (alive) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (alive) {
          setFetching(false);
        }
      }
    }
    loadPost();
    return () => {
      alive = false;
    };
  }, [draftKey, routeSlug]);

  useEffect(() => {
    if (!fetching) {
      localStorage.setItem(draftKey, JSON.stringify(formData));
    }
  }, [draftKey, fetching, formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/posts/${routeSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update post");
      }
      localStorage.removeItem(draftKey);
      router.push(`/posts/${formData.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  if (fetching) {
    return <p className="py-20 text-center text-[var(--muted)]">正在加载编辑器...</p>;
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="ui-surface rounded-2xl p-6">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">编辑文章</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">你正在编辑：{formData.title || routeSlug}</p>
      </section>
      {error && <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <EditorWorkspace
          content={formData.content}
          coverImage={formData.coverImage}
          excerpt={formData.excerpt}
          slug={formData.slug}
          title={formData.title}
          onContentChange={(value) => setFormData((prev) => ({ ...prev, content: value }))}
          onCoverImageChange={(value) => setFormData((prev) => ({ ...prev, coverImage: value }))}
          onExcerptChange={(value) => setFormData((prev) => ({ ...prev, excerpt: value }))}
          onSlugChange={(value) => setFormData((prev) => ({ ...prev, slug: value }))}
          onTitleChange={(value) => setFormData((prev) => ({ ...prev, title: value }))}
        />

        <div className="space-y-4">
          <PublishChecklist content={formData.content} coverImage={formData.coverImage} slug={formData.slug} title={formData.title} />
          <section className="ui-surface rounded-2xl p-5">
            <label className="mb-3 flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input
                checked={formData.published}
                className="h-4 w-4 rounded border-[var(--border)]"
                onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))}
                type="checkbox"
              />
              发布文章
            </label>
            <div className="flex flex-col gap-2">
              <Button disabled={isLoading} type="submit">
                {isLoading ? "保存中..." : "保存修改"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                取消
              </Button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
