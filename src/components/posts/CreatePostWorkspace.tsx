"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/ui";
import { generatePostSlug } from "@/lib/slug";
import { EditorWorkspace } from "./EditorWorkspace";
import { PublishChecklist } from "./PublishChecklist";

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

const initialFormData = {
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  coverImage: "",
  categoryId: "",
  tagIds: [] as string[],
  published: false,
};

function normalizeDraft(payload: unknown) {
  // 本地草稿来自 localStorage，需要在恢复时做一次兜底清洗，避免脏数据污染表单状态。
  const data = (payload ?? {}) as Partial<typeof initialFormData>;

  return {
    ...initialFormData,
    ...data,
    categoryId: typeof data.categoryId === "string" ? data.categoryId : "",
    tagIds: Array.isArray(data.tagIds) ? data.tagIds.filter((tagId): tagId is string => typeof tagId === "string") : [],
    published: data.published === true,
  };
}

export function CreatePostWorkspace() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [formData, setFormData] = useState(initialFormData);
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);

  // 新建文章使用固定 key，便于在刷新后继续恢复同一份未提交草稿。
  const draftKey = useMemo(() => "author:draft:new", []);
  const canSubmit = useMemo(
    () => formData.title.trim().length > 0 && formData.slug.trim().length > 0 && formData.content.trim().length > 0,
    [formData]
  );

  useEffect(() => {
    let active = true;

    async function loadTaxonomy() {
      try {
        // 分类和标签在右侧发布面板同时使用，这里并行拉取可以减少等待时间。
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
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;

    try {
      const parsed = normalizeDraft(JSON.parse(raw));
      setFormData(parsed);
      // 如果恢复出来的 slug 与当前规则自动生成的不一致，说明用户曾手动编辑过 slug。
      setIsSlugManuallyEdited(Boolean(parsed.slug) && parsed.slug !== generatePostSlug(parsed.title));
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey]);

  useEffect(() => {
    setSaveStatus("saving");
    const timer = window.setTimeout(() => {
      // 给输入加一点防抖，避免每次击键都同步写 localStorage。
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
      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      localStorage.removeItem(draftKey);
      // 创建成功后直接跳转到文章详情页，便于作者立即预览实际发布结果。
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
          onSlugChange={(value) => {
            setIsSlugManuallyEdited(true);
            setFormData((prev) => ({ ...prev, slug: value }));
          }}
          onTitleChange={(value) =>
            setFormData((prev) => ({
              ...prev,
              title: value,
              // 只有在用户没有手动覆盖时，标题变更才继续驱动自动 slug。
              slug: isSlugManuallyEdited ? prev.slug : generatePostSlug(value),
            }))
          }
        />

        <div className="space-y-4">
          <PublishChecklist content={formData.content} coverImage={formData.coverImage} slug={formData.slug} title={formData.title} />
          <section className="ui-surface rounded-2xl p-5 shadow-[0_16px_30px_-24px_rgba(15,118,110,0.45)]">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">发布面板</p>
            <p className="mt-2 text-sm text-[var(--muted)]">自动草稿状态：{saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : "未开始"}</p>

            <div className="mt-4 space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="post-category">
                  分类
                </label>
                <select
                  id="post-category"
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
                    const inputId = `post-tag-${tag.id}`;
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
              <p>分类：{categories.find((category) => category.id === formData.categoryId)?.name ?? "未选择"}</p>
              <p>标签：{formData.tagIds.length > 0 ? `${formData.tagIds.length} 个` : "未选择"}</p>
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
