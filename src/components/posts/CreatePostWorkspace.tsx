"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/ui";
import { EditorWorkspace } from "./EditorWorkspace";
import { PublishChecklist } from "./PublishChecklist";

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/--+/g, "-")
    .trim();
}

const initialFormData = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  coverImage: "",
  published: false,
};

export function CreatePostWorkspace() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [formData, setFormData] = useState(initialFormData);

  const draftKey = useMemo(() => "author:draft:new", []);
  const canSubmit = useMemo(
    () => formData.title.trim().length > 0 && formData.slug.trim().length > 0 && formData.content.trim().length > 0,
    [formData]
  );

  useEffect(() => {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as typeof initialFormData;
      setFormData(parsed);
    } catch {
      localStorage.removeItem(draftKey);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

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
      router.push(`/posts/${data.data?.slug ?? formData.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PageHeader
        eyebrow="Editor"
        title="新建文章"
        description="在统一后台工作台中完成 Markdown 创作、实时预览、草稿自动保存和发布检查。"
        action={
          <>
            <Button disabled={isLoading || !canSubmit} size="sm" type="submit">
              {isLoading ? "提交中..." : formData.published ? "发布文章" : "保存草稿"}
            </Button>
            <Button onClick={() => router.push("/admin/posts")} size="sm" type="button" variant="outline">
              返回列表
            </Button>
          </>
        }
      />

      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
          <section className="ui-surface rounded-2xl p-5 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.45)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">发布面板</p>
            <p className="mt-2 text-sm text-[var(--muted)]">自动草稿状态：{saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : "未开始"}</p>
            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input
                checked={formData.published}
                className="h-4 w-4 rounded border-[var(--border)]"
                onChange={(event) => setFormData((prev) => ({ ...prev, published: event.target.checked }))}
                type="checkbox"
              />
              直接发布
            </label>
            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
              <p>Slug：{formData.slug || "未生成"}</p>
              <p>摘要：{formData.excerpt ? `${formData.excerpt.length} 字` : "未填写"}</p>
              <p>封面：{formData.coverImage ? "已设置" : "未设置"}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button disabled={isLoading || !canSubmit} type="submit">
                {isLoading ? "提交中..." : formData.published ? "发布文章" : "保存草稿"}
              </Button>
              <Button onClick={() => router.push("/admin/posts")} type="button" variant="outline">
                取消
              </Button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
