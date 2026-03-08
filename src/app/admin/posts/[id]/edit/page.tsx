"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { EditorWorkspace, PublishChecklist } from "@/components/posts";
import { Button } from "@/components/ui";
import { generatePostSlug } from "@/lib/slug";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type TagOption = {
  id: string;
  name: string;
  slug: string;
};

type PostTag = {
  id: string;
  name: string;
  slug: string;
};

export default function AdminPostEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({ title: "", slug: "", content: "", excerpt: "", coverImage: "", categoryId: "", tagIds: [] as string[], published: false });
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);

  const canSubmit = useMemo(() => formData.title.trim().length > 0 && formData.slug.trim().length > 0 && formData.content.trim().length > 0, [formData]);

  useEffect(() => {
    let active = true;

    async function loadTaxonomy() {
      try {
        // 编辑页和新建页保持一致：分类、标签都由同一套公开目录接口提供。
        const [categoriesResponse, tagsResponse] = await Promise.all([fetch("/api/categories"), fetch("/api/tags")]);
        const [categoriesJson, tagsJson] = await Promise.all([categoriesResponse.json(), tagsResponse.json()]);

        if (!active) return;

        setCategories(Array.isArray(categoriesJson?.data) ? categoriesJson.data : []);
        setTags(Array.isArray(tagsJson?.data) ? tagsJson.data : []);
      } catch {
        if (!active) return;
        setCategories([]);
        setTags([]);
      }
    }

    void loadTaxonomy();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/admin/posts/${params.id}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "加载失败");
        if (!active) return;
        setFormData({
          title: data.data.title ?? "",
          slug: data.data.slug ?? "",
          content: data.data.content ?? "",
          excerpt: data.data.excerpt ?? "",
          coverImage: data.data.coverImage ?? "",
          categoryId: data.data.categoryId ?? "",
          tagIds: Array.isArray(data.data.tags) ? data.data.tags.map((tag: PostTag) => tag.id) : [],
          published: Boolean(data.data.published),
        });
        // 编辑已有文章时也沿用“自动生成 + 用户可手动覆盖”的 slug 规则。
        setIsSlugManuallyEdited(Boolean(data.data.slug) && data.data.slug !== generatePostSlug(data.data.title ?? ""));
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    if (params.id) {
      void load();
    }
    return () => {
      active = false;
    };
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/posts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "保存失败");
      router.push(`/posts/${data.data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <PageHeader
        eyebrow="Editor"
        title="后台编辑文章"
        description="主区域专注 Markdown 编辑，右侧提供发布控制与质量检查。"
        action={
          <>
            <Button type="submit" disabled={saving || !canSubmit} size="sm">{saving ? "保存中..." : "保存修改"}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>返回列表</Button>
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
          onSlugChange={(value) => {
            setIsSlugManuallyEdited(true);
            setFormData((prev) => ({ ...prev, slug: value }));
          }}
          onTitleChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              title: value,
              // 一旦用户手动改过 slug，后续标题编辑不再覆盖它。
              slug: isSlugManuallyEdited ? prev.slug : generatePostSlug(value),
            }))
          }
        />

        <div className="space-y-4">
          <PublishChecklist content={formData.content} coverImage={formData.coverImage} slug={formData.slug} title={formData.title} />
          <section className="ui-surface rounded-2xl p-5 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.45)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">发布面板</p>
            <div className="mt-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="edit-post-category">
                  分类
                </label>
                <select
                  id="edit-post-category"
                  className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  value={formData.categoryId}
                  onChange={(event) => setFormData((prev) => ({ ...prev, categoryId: event.target.value }))}
                >
                  <option value="">未分类</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-[var(--foreground)]">标签</legend>
                <div className="space-y-2">
                  {tags.length === 0 ? <p className="text-sm text-[var(--muted)]">暂无可选标签</p> : null}
                  {tags.map((tag) => {
                    const inputId = `edit-post-tag-${tag.id}`;
                    const checked = formData.tagIds.includes(tag.id);

                    return (
                      <label key={tag.id} htmlFor={inputId} className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                        <input
                          id={inputId}
                          type="checkbox"
                          className="h-4 w-4 rounded border-[var(--border)]"
                          checked={checked}
                          onChange={(event) =>
                            setFormData((prev) => ({
                              ...prev,
                              tagIds: event.target.checked ? [...prev.tagIds, tag.id] : prev.tagIds.filter((id) => id !== tag.id),
                            }))
                          }
                        />
                        {tag.name}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-[var(--foreground)]">
              <input type="checkbox" className="h-4 w-4 rounded border-[var(--border)]" checked={formData.published} onChange={(e) => setFormData((prev) => ({ ...prev, published: e.target.checked }))} />
              直接发布
            </label>
            <div className="mt-4 space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
              <p>Slug：{formData.slug || "未生成"}</p>
              <p>分类：{categories.find((category) => category.id === formData.categoryId)?.name ?? "未选择"}</p>
              <p>标签：{formData.tagIds.length > 0 ? `${formData.tagIds.length} 个` : "未选择"}</p>
              <p>摘要：{formData.excerpt ? `${formData.excerpt.length} 字` : "未填写"}</p>
              <p>封面：{formData.coverImage ? "已设置" : "未设置"}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <Button disabled={saving || !canSubmit} type="submit">{saving ? "保存中..." : "保存修改"}</Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>取消</Button>
            </div>
          </section>
        </div>
      </div>
    </form>
  );
}
