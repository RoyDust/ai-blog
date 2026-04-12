"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input } from "@/components/ui";
import { useInspectorState } from "@/hooks/useInspectorState";
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

function resolvePostRoute(post: { id?: string | null; slug?: string | null; published?: boolean | null }, fallbackSlug: string) {
  if (post.published) {
    return `/posts/${post.slug ?? fallbackSlug}`;
  }

  if (post.id) {
    return `/admin/posts/${post.id}/edit`;
  }

  return "/admin/posts";
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
  const inspector = useInspectorState({
    defaultPanel: "status",
    allowedPanels: ["status", "readiness", "metadata"] as const,
  });
  const coverFileInputRef = useRef<HTMLInputElement | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");

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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    setIsLoading(true);
    setError("");

    try {
      const nativeEvent = event.nativeEvent as unknown as { submitter?: HTMLElement | null };
      const submitter = nativeEvent.submitter;
      const intent =
        submitter instanceof HTMLButtonElement && submitter.getAttribute("name") === "intent"
          ? submitter.value
          : null;
      const published = intent === "publish" ? true : intent === "draft" ? false : formData.published;
      const payload = { ...formData, published };

      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create post");
      }

      localStorage.removeItem(draftKey);
      router.push(resolvePostRoute(data.data ?? {}, payload.slug));
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
            <Button disabled={isLoading || !canSubmit} name="intent" size="sm" type="submit" value="draft" variant="outline">
              保存草稿
            </Button>
            <Button disabled={isLoading || !canSubmit} name="intent" size="sm" type="submit" value="publish">
              {isLoading ? "提交中..." : "发布文章"}
            </Button>
            <Button onClick={() => router.push("/admin/posts")} size="sm" type="button" variant="outline">
              返回列表
            </Button>
          </>
        }
      />

      {error ? <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <EditorWorkspace
          mode="content"
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
          <div className="xl:hidden">
            <Toolbar
              leading={
                <>
                  <button
                    type="button"
                    aria-pressed={inspector.panel === "status"}
                    className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                    onClick={() => inspector.setPanel("status")}
                  >
                    状态
                  </button>
                  <button
                    type="button"
                    aria-pressed={inspector.panel === "readiness"}
                    className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                    onClick={() => inspector.setPanel("readiness")}
                  >
                    准备度
                  </button>
                  <button
                    type="button"
                    aria-pressed={inspector.panel === "metadata"}
                    className="ui-btn rounded-lg border border-transparent px-2 py-1 text-sm text-[var(--foreground)] hover:border-[var(--border)] hover:bg-[var(--surface)] aria-pressed:border-[var(--border)] aria-pressed:bg-[var(--surface)]"
                    onClick={() => inspector.setPanel("metadata")}
                  >
                    元数据
                  </button>
                </>
              }
            />
          </div>

          <div className={inspector.panel === "status" ? "" : "hidden xl:block"}>
            <WorkspacePanel title="文章状态" description="保存前先决定该内容停留在草稿还是已发布。">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[var(--foreground)]">当前状态</p>
                    <p className="text-sm text-[var(--muted)]">
                      自动草稿状态：{saveStatus === "saving" ? "保存中..." : saveStatus === "saved" ? "已保存" : "未开始"}
                    </p>
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

                <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-3 text-sm text-[var(--muted)]">
                  <p>Slug：{formData.slug || "未生成"}</p>
                  <p>分类：{categories.find((category) => category.id === formData.categoryId)?.name ?? "未选择"}</p>
                  <p>标签：{formData.tagIds.length > 0 ? `${formData.tagIds.length} 个` : "未选择"}</p>
                  <p>摘要：{formData.excerpt ? `${formData.excerpt.length} 字` : "未填写"}</p>
                  <p>封面：{formData.coverImage ? "已设置" : "未设置"}</p>
                </div>
              </div>
            </WorkspacePanel>
          </div>

          <div className={inspector.panel === "readiness" ? "" : "hidden xl:block"}>
            <WorkspacePanel title="发布准备度" description="围绕标题、slug、正文和封面给出清晰检查。">
              <PublishChecklist
                variant="inline"
                content={formData.content}
                coverImage={formData.coverImage}
                slug={formData.slug}
                title={formData.title}
              />
            </WorkspacePanel>
          </div>

          <div className={inspector.panel === "metadata" ? "" : "hidden xl:block"}>
            <WorkspacePanel title="元数据" description="分类、标签、摘要和封面集中维护。">
              <div className="space-y-4">
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
                      id="create-cover-upload"
                      type="file"
                      onChange={handleCoverUpload}
                    />
                    <Button type="button" size="sm" onClick={() => coverFileInputRef.current?.click()} disabled={isCoverUploading}>
                      {isCoverUploading ? "上传中..." : "上传封面到七牛"}
                    </Button>
                    <p className="text-sm text-[var(--muted)]">支持选择图片后直接上传，并自动回填封面地址。</p>
                  </div>
                  {coverUploadError ? <p className="mt-2 text-sm text-rose-500">{coverUploadError}</p> : null}
                </div>
              </div>
            </WorkspacePanel>
          </div>
        </div>
      </div>
    </form>
  );
}
