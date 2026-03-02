"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorWorkspace, PublishChecklist } from "@/components/posts";
import { Button } from "@/components/ui";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

export default function WritePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    coverImage: "",
    published: false,
  });

  const draftKey = useMemo(() => "author:draft:new", []);

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as typeof formData;
        setFormData(parsed);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
  }, [draftKey]);

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      localStorage.setItem(draftKey, JSON.stringify(formData));
      setSaveStatus("saved");
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftKey, formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to create post");
      }
      localStorage.removeItem(draftKey);
      router.push(`/posts/${formData.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="ui-surface rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">创作工作台</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">编辑、检查并发布你的文章。</p>
          </div>
          <span className="text-sm text-[var(--muted)]">
            自动保存状态: {saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : "未开始"}
          </span>
        </div>
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
          onTitleChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              title: value,
              slug: generateSlug(value),
            }))
          }
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
              直接发布
            </label>
            <div className="flex flex-col gap-2">
              <Button disabled={isLoading} type="submit">
                {isLoading ? "发布中..." : formData.published ? "发布文章" : "保存草稿"}
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
