"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { PostAiWorkspace } from "@/components/admin/ai/PostAiWorkspace";
import { EditorWorkspace, PublishChecklist } from "@/components/posts";
import { Button, Input, Modal } from "@/components/ui";
import { useInspectorState } from "@/hooks/useInspectorState";
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

function resolvePostRoute(post: { id?: string | null; slug?: string | null; published?: boolean | null }, fallbackId: string, fallbackSlug: string) {
  if (post.published) {
    return `/posts/${post.slug ?? fallbackSlug}`;
  }

  return `/admin/posts/${post.id ?? fallbackId}/edit`;
}

export default function AdminPostEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    seoDescription: "",
    coverImage: "",
    categoryId: "",
    tagIds: [] as string[],
    published: false,
    featured: false,
  });
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const inspector = useInspectorState({
    defaultPanel: "status",
    allowedPanels: ["status", "metadata", "ai"] as const,
  });
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [activeModal, setActiveModal] = useState<"metadata" | "ai" | null>(null);

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
          seoDescription: data.data.seoDescription ?? "",
          coverImage: data.data.coverImage ?? "",
          categoryId: data.data.categoryId ?? "",
          tagIds: Array.isArray(data.data.tags) ? data.data.tags.map((tag: PostTag) => tag.id) : [],
          published: Boolean(data.data.published),
          featured: Boolean(data.data.featured),
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

  useEffect(() => {
    if (inspector.panel === "metadata" || inspector.panel === "ai") {
      setActiveModal(inspector.panel);
      return;
    }

    setActiveModal(null);
  }, [inspector.panel]);

  const openDetailPanel = (panel: "metadata" | "ai") => {
    setActiveModal(panel);
    inspector.setPanel(panel);
  };

  const closeDetailPanel = () => {
    setActiveModal(null);
    if (inspector.panel === "metadata" || inspector.panel === "ai") {
      inspector.setPanel("status");
    }
  };

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
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : "生成摘要失败");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsCoverUploading(true);
    setCoverUploadError("");

    try {
      const tokenResponse = await fetch("/api/admin/uploads/qiniu-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.success) {
        throw new Error(tokenData.error || "获取上传凭证失败");
      }

      const payload = new FormData();
      payload.append("file", file);
      payload.append("token", tokenData.data.token);
      payload.append("key", tokenData.data.key);

      const uploadResponse = await fetch(tokenData.data.uploadUrl, {
        method: "POST",
        body: payload,
      });

      if (!uploadResponse.ok) {
        throw new Error("上传到七牛失败");
      }

      const normalizedDomain = String(tokenData.data.domain).replace(/\/$/, "");
      setFormData((prev) => ({ ...prev, coverImage: `${normalizedDomain}/${tokenData.data.key}` }));
    } catch (error) {
      setCoverUploadError(error instanceof Error ? error.message : "上传失败");
    } finally {
      setIsCoverUploading(false);
      if (coverFileInputRef.current) {
        coverFileInputRef.current.value = "";
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");

    try {
      const nativeEvent = e.nativeEvent as unknown as { submitter?: HTMLElement | null };
      const submitter = nativeEvent.submitter;
      const intent =
        submitter instanceof HTMLButtonElement && submitter.getAttribute("name") === "intent"
          ? submitter.value
          : null;
      const published = intent === "publish" ? true : intent === "draft" ? false : formData.published;
      const payload = { ...formData, published };

      const res = await fetch(`/api/admin/posts/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "保存失败");
      router.push(resolvePostRoute(data.data ?? {}, params.id, payload.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const metadataEditor = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-4">
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
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
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

        <Input
          label="封面图 URL"
          placeholder="https://example.com/cover.jpg"
          value={formData.coverImage}
          onChange={(event) => setFormData((prev) => ({ ...prev, coverImage: event.target.value }))}
        />

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={coverFileInputRef}
              accept="image/*"
              className="hidden"
              id="admin-cover-upload"
              type="file"
              onChange={handleCoverUpload}
            />
            <Button type="button" size="sm" onClick={() => coverFileInputRef.current?.click()} disabled={isCoverUploading}>
              {isCoverUploading ? "上传中..." : "上传封面到七牛"}
            </Button>
            <p className="text-sm text-[var(--muted)]">选择图片后自动回填封面地址。</p>
          </div>
          {coverUploadError ? <p className="mt-2 text-sm text-rose-500">{coverUploadError}</p> : null}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-[var(--foreground)]">摘要</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isSummarizing || !formData.content.trim()}
              onClick={handleGenerateSummary}
            >
              {isSummarizing ? "生成中..." : "AI 生成摘要"}
            </Button>
          </div>
          <Input placeholder="文章摘要（可选）" value={formData.excerpt} onChange={(event) => setFormData((prev) => ({ ...prev, excerpt: event.target.value }))} />
          <p className="text-sm text-[var(--muted)]">基于当前正文生成适合列表页与 SEO 展示的简短摘要。</p>
          {summaryError ? <p className="text-sm text-rose-500">{summaryError}</p> : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-[var(--foreground)]" htmlFor="edit-post-seo-description">
            SEO 描述
          </label>
          <textarea
            id="edit-post-seo-description"
            className="ui-ring min-h-36 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm leading-6 text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            placeholder="搜索结果和分享卡片优先使用的描述"
            value={formData.seoDescription}
            onChange={(event) => setFormData((prev) => ({ ...prev, seoDescription: event.target.value }))}
          />
          <p className="text-sm text-[var(--muted)]">为空时前台元数据会继续回退到文章摘要。</p>
        </div>
      </div>
    </div>
  );

  const aiWorkspace = (
    <PostAiWorkspace
      postId={params.id}
      disabled={!params.id}
      onApplied={(post) =>
        setFormData((prev) => ({
          ...prev,
          title: post.title ?? prev.title,
          slug: post.slug ?? prev.slug,
          excerpt: post.excerpt ?? prev.excerpt,
          seoDescription: post.seoDescription ?? prev.seoDescription,
          categoryId: post.category?.id ?? prev.categoryId,
          tagIds: Array.isArray(post.tags) ? post.tags.map((tag) => tag.id) : prev.tagIds,
        }))
      }
    />
  );

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <form className="flex min-h-0 flex-col gap-4 lg:h-[calc(100dvh-10rem)] lg:overflow-hidden" onSubmit={handleSubmit}>
      <PageHeader
        eyebrow="Editor"
        title="后台编辑文章"
        description="正文保持在单屏工作台内，元数据和 AI 操作按需展开。"
        action={
          <>
            <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="draft" variant="outline">
              保存草稿
            </Button>
            <Button type="submit" disabled={saving || !canSubmit} size="sm" name="intent" value="publish">
              发布文章
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>返回列表</Button>
          </>
        }
      />

      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <section className="ui-surface rounded-2xl px-5 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="shrink-0">
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">发布准备度</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">围绕标题、slug、正文和封面给出发布前检查。</p>
          </div>
          <PublishChecklist
            variant="bar"
            content={formData.content}
            coverImage={formData.coverImage}
            slug={formData.slug}
            title={formData.title}
          />
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <EditorWorkspace
          className="h-full"
          fillHeight
          mode="content"
          contentMinRows={18}
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

        <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
          <Toolbar
            leading={
              <>
                <button
                  type="button"
                  aria-pressed={inspector.panel === "status" && activeModal === null}
                  className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                  onClick={() => {
                    setActiveModal(null);
                    inspector.setPanel("status");
                  }}
                >
                  状态
                </button>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-pressed={activeModal === "metadata" || inspector.panel === "metadata"}
                  className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                  onClick={() => openDetailPanel("metadata")}
                >
                  元数据
                </button>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-pressed={activeModal === "ai" || inspector.panel === "ai"}
                  className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                  onClick={() => openDetailPanel("ai")}
                >
                  AI 工作台
                </button>
              </>
            }
          />

          <div className="space-y-3">
            <WorkspacePanel title="文章状态" description="保存前先决定该内容停留在草稿还是已发布。">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">当前状态</p>
                    <p className="text-sm text-[var(--muted)]">先切换状态，再保存。</p>
                  </div>
                  <StatusBadge tone={formData.published ? "success" : "warning"}>{formData.published ? "已发布" : "草稿"}</StatusBadge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.published ? "outline" : "primary"}
                    disabled={!formData.published}
                    onClick={() => setFormData((prev) => ({ ...prev, published: false }))}
                  >
                    保持草稿
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.published ? "primary" : "outline"}
                    disabled={formData.published}
                    onClick={() => setFormData((prev) => ({ ...prev, published: true }))}
                  >
                    切换为已发布
                  </Button>
                </div>
              </div>
            </WorkspacePanel>

            <WorkspacePanel title="精选状态" description="精选文章会出现在首页和文章列表顶部。">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">当前状态</p>
                    <p className="text-sm text-[var(--muted)]">最多 3 篇精选文章会展示在前台。</p>
                  </div>
                  <StatusBadge tone={formData.featured ? "success" : "neutral"}>{formData.featured ? "精选" : "普通"}</StatusBadge>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.featured ? "outline" : "primary"}
                    disabled={!formData.featured}
                    onClick={() => setFormData((prev) => ({ ...prev, featured: false }))}
                  >
                    取消精选
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.featured ? "primary" : "outline"}
                    disabled={formData.featured}
                    onClick={() => setFormData((prev) => ({ ...prev, featured: true }))}
                  >
                    设为精选
                  </Button>
                </div>
              </div>
            </WorkspacePanel>
          </div>
        </div>
      </div>
      <Modal
        isOpen={activeModal === "metadata"}
        onClose={closeDetailPanel}
        title="元数据"
        size="4xl"
        contentClassName="max-h-[calc(100dvh-7rem)]"
      >
        {metadataEditor}
      </Modal>

      <Modal
        isOpen={activeModal === "ai"}
        onClose={closeDetailPanel}
        title="AI 工作台"
        size="3xl"
        contentClassName="max-h-[calc(100dvh-7rem)]"
      >
        {aiWorkspace}
      </Modal>
    </form>
  );
}
