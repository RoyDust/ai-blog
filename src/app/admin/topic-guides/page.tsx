"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button } from "@/components/admin/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { getApiErrorMessage } from "@/lib/admin-api-client";

type GuideStatus = "draft" | "published" | "archived";

interface AdminGuidePostRow {
  id: string;
  order: number;
  note: string | null;
  post: {
    id: string;
    title: string;
    slug: string;
    published: boolean;
    deletedAt: string | null;
  };
}

interface AdminGuideRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  status: GuideStatus;
  createdAt: string;
  updatedAt: string;
  posts: AdminGuidePostRow[];
  _count?: {
    posts: number;
  };
}

interface AdminPostOption {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  deletedAt: string | null;
}

interface GuideFormState {
  id: string;
  title: string;
  slug: string;
  description: string;
  status: GuideStatus;
  selectedPostIds: string[];
  notesByPostId: Record<string, string>;
}

const emptyForm: GuideFormState = {
  id: "",
  title: "",
  slug: "",
  description: "",
  status: "draft",
  selectedPostIds: [],
  notesByPostId: {},
};

const statusLabels: Record<GuideStatus, string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已归档",
};

const statusTone: Record<GuideStatus, "neutral" | "success" | "warning"> = {
  draft: "neutral",
  published: "success",
  archived: "warning",
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function guideToForm(guide: AdminGuideRow): GuideFormState {
  const selectedPostIds = guide.posts.map((item) => item.post.id);
  const notesByPostId = Object.fromEntries(guide.posts.map((item) => [item.post.id, item.note ?? ""]));

  return {
    id: guide.id,
    title: guide.title,
    slug: guide.slug,
    description: guide.description ?? "",
    status: guide.status,
    selectedPostIds,
    notesByPostId,
  };
}

function moveItem(items: string[], id: string, direction: -1 | 1) {
  const index = items.indexOf(id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return items;

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export default function AdminTopicGuidesPage() {
  const [guides, setGuides] = useState<AdminGuideRow[]>([]);
  const [postOptions, setPostOptions] = useState<AdminPostOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<GuideFormState>(emptyForm);

  async function fetchGuides() {
    try {
      const response = await fetch("/api/admin/topic-guides");
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, "专题导读加载失败"));
        setGuides([]);
        return;
      }

      setGuides(payload.data);
    } catch {
      toast.error("专题导读加载失败，请稍后重试");
      setGuides([]);
    }
  }

  async function fetchPostOptions() {
    try {
      const response = await fetch("/api/admin/posts?status=published&limit=50");
      const payload = await response.json();

      if (!payload.success) {
        setPostOptions([]);
        return;
      }

      setPostOptions(payload.data.map((post: AdminPostOption) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        published: post.published,
        deletedAt: post.deletedAt,
      })));
    } catch {
      setPostOptions([]);
    }
  }

  useEffect(() => {
    void Promise.all([fetchGuides(), fetchPostOptions()]).finally(() => setLoading(false));
  }, []);

  const filteredGuides = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return guides;
    return guides.filter((guide) => guide.title.toLowerCase().includes(keyword) || guide.slug.toLowerCase().includes(keyword));
  }, [guides, query]);

  const selectedPosts = form.selectedPostIds
    .map((postId) => postOptions.find((post) => post.id === postId) ?? guides.flatMap((guide) => guide.posts).find((item) => item.post.id === postId)?.post)
    .filter((post): post is AdminPostOption => Boolean(post));

  function togglePost(post: AdminPostOption) {
    setForm((prev) => {
      if (prev.selectedPostIds.includes(post.id)) {
        const { [post.id]: _removed, ...notesByPostId } = prev.notesByPostId;
        void _removed;
        return {
          ...prev,
          selectedPostIds: prev.selectedPostIds.filter((id) => id !== post.id),
          notesByPostId,
        };
      }

      return {
        ...prev,
        selectedPostIds: [...prev.selectedPostIds, post.id],
        notesByPostId: { ...prev.notesByPostId, [post.id]: "" },
      };
    });
  }

  async function submitGuide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    const posts = form.selectedPostIds.map((postId) => ({
      postId,
      note: form.notesByPostId[postId] ?? "",
    }));

    try {
      const response = await fetch(form.id ? `/api/admin/topic-guides/${form.id}` : "/api/admin/topic-guides", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          description: form.description,
          status: form.status,
          posts,
        }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, form.id ? "更新专题导读失败" : "创建专题导读失败"));
        return;
      }

      toast.success(form.id ? "专题导读已更新" : "专题导读已创建");
      setForm(emptyForm);
      await fetchGuides();
    } catch {
      toast.error(form.id ? "更新专题导读失败，请稍后重试" : "创建专题导读失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchGuideStatus(guide: AdminGuideRow, status: GuideStatus) {
    try {
      const response = await fetch(`/api/admin/topic-guides/${guide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, "专题状态更新失败"));
        return;
      }

      toast.success("专题状态已更新");
      await fetchGuides();
    } catch {
      toast.error("专题状态更新失败，请稍后重试");
    }
  }

  async function deleteGuide(guide: AdminGuideRow) {
    try {
      const response = await fetch(`/api/admin/topic-guides/${guide.id}`, { method: "DELETE" });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, "删除专题导读失败"));
        return;
      }

      toast.success("专题导读已删除");
      if (form.id === guide.id) {
        setForm(emptyForm);
      }
      setGuides((prev) => prev.filter((item) => item.id !== guide.id));
    } catch {
      toast.error("删除专题导读失败，请稍后重试");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="内容编排"
        title="专题导读"
        description="把已发布文章编排成可连续阅读的导读路径。第一版使用确定顺序和编辑备注，不接入 AI 排序。"
        action={
          <Link href="/guides">
            <Button size="sm" variant="outline">
              前台预览
            </Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <WorkspacePanel title={form.id ? "编辑专题" : "新建专题"} description="选择已发布文章后，可用上移/下移调整阅读顺序。" fillHeight={false}>
          <form onSubmit={submitGuide} className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">标题</span>
              <input
                required
                className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.title}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    title: event.target.value,
                    slug: prev.slug ? prev.slug : toSlug(event.target.value),
                  }))
                }
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">Slug</span>
              <input
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.slug}
                onChange={(event) => setForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">描述</span>
              <textarea
                className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-[var(--foreground)]">状态</span>
              <select
                className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as GuideStatus }))}
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
                <option value="archived">归档</option>
              </select>
            </label>

            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">选择文章</h3>
                <p className="mt-1 text-xs text-[var(--muted)]">只从已发布文章列表选择，公开页仍会再次过滤草稿和已删除文章。</p>
              </div>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                {postOptions.length > 0 ? postOptions.map((post) => (
                  <label key={post.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-muted)]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={form.selectedPostIds.includes(post.id)}
                      onChange={() => togglePost(post)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--foreground)]">{post.title}</span>
                      <span className="block truncate font-mono text-xs text-[var(--muted)]">/posts/{post.slug}</span>
                    </span>
                  </label>
                )) : (
                  <p className="px-2 py-4 text-sm text-[var(--muted)]">暂无可选文章</p>
                )}
              </div>
            </div>

            {selectedPosts.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">阅读顺序</h3>
                {selectedPosts.map((post, index) => (
                  <div key={post.id} className="rounded-xl border border-[var(--border)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{index + 1}. {post.title}</p>
                        <p className="truncate font-mono text-xs text-[var(--muted)]">/posts/{post.slug}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setForm((prev) => ({ ...prev, selectedPostIds: moveItem(prev.selectedPostIds, post.id, -1) }))}
                          disabled={index === 0}
                        >
                          上移
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => setForm((prev) => ({ ...prev, selectedPostIds: moveItem(prev.selectedPostIds, post.id, 1) }))}
                          disabled={index === selectedPosts.length - 1}
                        >
                          下移
                        </Button>
                      </div>
                    </div>
                    <textarea
                      aria-label={`${post.title} 导读备注`}
                      className="ui-ring mt-2 min-h-16 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      placeholder="这篇文章在专题中的阅读提示"
                      value={form.notesByPostId[post.id] ?? ""}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          notesByPostId: { ...prev.notesByPostId, [post.id]: event.target.value },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button disabled={submitting} size="sm" type="submit">
                {form.id ? "保存专题" : "创建专题"}
              </Button>
              {form.id ? (
                <Button disabled={submitting} size="sm" type="button" variant="outline" onClick={() => setForm(emptyForm)}>
                  取消编辑
                </Button>
              ) : null}
            </div>
          </form>
        </WorkspacePanel>

        <WorkspacePanel
          title="专题列表"
          description={`共 ${filteredGuides.length} 个专题导读`}
          actions={
            <input
              aria-label="搜索专题导读"
              className="ui-ring min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder="搜索标题或 slug"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
        >
          <Table className="min-w-[760px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[38%]">专题</TableHead>
                <TableHead className="w-[96px]">状态</TableHead>
                <TableHead className="w-[28%]">文章顺序</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-[var(--muted)]">
                    正在加载专题导读...
                  </TableCell>
                </TableRow>
              ) : filteredGuides.length > 0 ? (
                filteredGuides.map((guide) => (
                  <TableRow key={guide.id}>
                    <TableCell className="whitespace-normal align-top">
                      <div className="space-y-1">
                        <div className="font-medium text-[var(--foreground)]">{guide.title}</div>
                        <div className="font-mono text-xs text-[var(--muted)]">/guides/{guide.slug}</div>
                        {guide.description ? <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{guide.description}</p> : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <StatusBadge tone={statusTone[guide.status]}>{statusLabels[guide.status]}</StatusBadge>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <ol className="space-y-1 text-xs text-[var(--muted)]">
                        {guide.posts.slice(0, 4).map((item) => (
                          <li key={item.id} className="line-clamp-1">
                            {item.order}. {item.post.title}
                          </li>
                        ))}
                      </ol>
                      {guide.posts.length > 4 ? <p className="mt-1 text-xs text-[var(--muted)]">另 {guide.posts.length - 4} 篇</p> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => setForm(guideToForm(guide))}>
                          编辑
                        </button>
                        {guide.status !== "published" ? (
                          <button type="button" className="text-emerald-700 hover:underline" onClick={() => void patchGuideStatus(guide, "published")}>
                            发布
                          </button>
                        ) : (
                          <button type="button" className="text-amber-700 hover:underline" onClick={() => void patchGuideStatus(guide, "draft")}>
                            下线
                          </button>
                        )}
                        {guide.status !== "archived" ? (
                          <button type="button" className="text-[var(--foreground)] hover:underline" onClick={() => void patchGuideStatus(guide, "archived")}>
                            归档
                          </button>
                        ) : null}
                        <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={`/guides/${guide.slug}`}>
                          预览
                        </Link>
                        <button type="button" className="text-rose-600 hover:underline" onClick={() => void deleteGuide(guide)}>
                          删除
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-[var(--muted)]">
                    暂无专题导读
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </WorkspacePanel>
      </section>
    </div>
  );
}
