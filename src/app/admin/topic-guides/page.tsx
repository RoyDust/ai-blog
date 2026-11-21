"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button } from "@/components/admin/ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

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

const guideFormSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "请输入专题标题"),
  slug: z.string().trim().min(1, "请输入 slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 只能使用小写英文、数字和连字符"),
  description: z.string(),
  status: z.enum(["draft", "published", "archived"]),
  selectedPostIds: z.array(z.string()),
  notesByPostId: z.record(z.string(), z.string()),
});

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
  const [query, setQuery] = useState("");
  const guideForm = useForm<GuideFormState>({
    resolver: zodResolver(guideFormSchema),
    defaultValues: emptyForm,
  });
  const editingGuideId = guideForm.watch("id");
  const selectedPostIds = guideForm.watch("selectedPostIds");
  const notesByPostId = guideForm.watch("notesByPostId");

  const {
    data: guidesResponse,
    isLoading: guidesLoading,
    mutate: mutateGuides,
  } = useSWR<{ success?: boolean; data?: AdminGuideRow[] }>("/api/admin/topic-guides", apiFetcher, {
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key);
      toast.error(toErrorMessage(swrError, "专题导读加载失败，请稍后重试"));
    },
  });

  const {
    data: postsResponse,
    isLoading: optionsLoading,
  } = useSWR<{ success?: boolean; data?: AdminPostOption[] }>("/api/admin/posts?status=published&limit=50", apiFetcher, {
    revalidateOnMount: true,
  });

  const guides = useMemo(() => guidesResponse?.data ?? [], [guidesResponse?.data]);
  const postOptions = useMemo(
    () =>
      (postsResponse?.data ?? []).map((post: AdminPostOption) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        published: post.published,
        deletedAt: post.deletedAt,
      })),
    [postsResponse?.data],
  );
  const loading = guidesLoading || optionsLoading;

  const filteredGuides = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return guides;
    return guides.filter((guide) => guide.title.toLowerCase().includes(keyword) || guide.slug.toLowerCase().includes(keyword));
  }, [guides, query]);

  const selectedPosts = selectedPostIds
    .map((postId) => postOptions.find((post) => post.id === postId) ?? guides.flatMap((guide) => guide.posts).find((item) => item.post.id === postId)?.post)
    .filter((post): post is AdminPostOption => Boolean(post));

  function togglePost(post: AdminPostOption) {
    if (selectedPostIds.includes(post.id)) {
      const { [post.id]: _removed, ...nextNotesByPostId } = notesByPostId;
      void _removed;
      guideForm.setValue("selectedPostIds", selectedPostIds.filter((id) => id !== post.id), { shouldDirty: true });
      guideForm.setValue("notesByPostId", nextNotesByPostId, { shouldDirty: true });
      return;
    }

    guideForm.setValue("selectedPostIds", [...selectedPostIds, post.id], { shouldDirty: true });
    guideForm.setValue("notesByPostId", { ...notesByPostId, [post.id]: "" }, { shouldDirty: true });
  }

  async function submitGuide(values: GuideFormState) {
    const posts = values.selectedPostIds.map((postId) => ({
      postId,
      note: values.notesByPostId[postId] ?? "",
    }));

    try {
      await apiMutate(values.id ? `/api/admin/topic-guides/${values.id}` : "/api/admin/topic-guides", {
        method: values.id ? "PATCH" : "POST",
        body: JSON.stringify({
          title: values.title,
          slug: values.slug,
          description: values.description,
          status: values.status,
          posts,
        }),
      });

      toast.success(values.id ? "专题导读已更新" : "专题导读已创建");
      guideForm.reset(emptyForm);
      void mutateGuides();
    } catch (error) {
      toast.error(toErrorMessage(error, values.id ? "更新专题导读失败，请稍后重试" : "创建专题导读失败，请稍后重试"));
    }
  }

  async function patchGuideStatus(guide: AdminGuideRow, status: GuideStatus) {
    try {
      await apiMutate(`/api/admin/topic-guides/${guide.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      toast.success("专题状态已更新");
      void mutateGuides();
    } catch (error) {
      toast.error(toErrorMessage(error, "专题状态更新失败，请稍后重试"));
    }
  }

  async function deleteGuide(guide: AdminGuideRow) {
    try {
      await apiMutate(`/api/admin/topic-guides/${guide.id}`, { method: "DELETE" });

      toast.success("专题导读已删除");
      if (guideForm.getValues("id") === guide.id) {
        guideForm.reset(emptyForm);
      }
      void mutateGuides();
    } catch (error) {
      toast.error(toErrorMessage(error, "删除专题导读失败，请稍后重试"));
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
        <WorkspacePanel title={editingGuideId ? "编辑专题" : "新建专题"} description="选择已发布文章后，可用上移/下移调整阅读顺序。" fillHeight={false}>
          <Form {...guideForm}>
            <form onSubmit={guideForm.handleSubmit(submitGuide)} className="space-y-4">
              <FormField
                control={guideForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <input
                        className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!guideForm.getValues("slug")) {
                            guideForm.setValue("slug", toSlug(event.target.value), { shouldValidate: true });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={guideForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <input
                        className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        {...field}
                        onChange={(event) => field.onChange(toSlug(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={guideForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <textarea className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={guideForm.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>状态</FormLabel>
                    <FormControl>
                      <select className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" {...field}>
                        <option value="draft">草稿</option>
                        <option value="published">发布</option>
                        <option value="archived">归档</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={guideForm.control}
                name="selectedPostIds"
                render={() => (
                  <FormItem>
                    <FormLabel>选择文章</FormLabel>
                    <FormDescription>只从已发布文章列表选择，公开页仍会再次过滤草稿和已删除文章。</FormDescription>
                    <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2">
                      {postOptions.length > 0 ? postOptions.map((post) => (
                        <label key={post.id} className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface-muted)]">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedPostIds.includes(post.id)}
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
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                          onClick={() => guideForm.setValue("selectedPostIds", moveItem(selectedPostIds, post.id, -1), { shouldDirty: true })}
                          disabled={index === 0}
                        >
                          上移
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => guideForm.setValue("selectedPostIds", moveItem(selectedPostIds, post.id, 1), { shouldDirty: true })}
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
                      value={notesByPostId[post.id] ?? ""}
                      onChange={(event) =>
                        guideForm.setValue("notesByPostId", { ...notesByPostId, [post.id]: event.target.value }, { shouldDirty: true })
                      }
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button disabled={guideForm.formState.isSubmitting} size="sm" type="submit">
                {guideForm.formState.isSubmitting ? "保存中..." : editingGuideId ? "保存专题" : "创建专题"}
              </Button>
              {editingGuideId ? (
                <Button disabled={guideForm.formState.isSubmitting} size="sm" type="button" variant="outline" onClick={() => guideForm.reset(emptyForm)}>
                  取消编辑
                </Button>
              ) : null}
            </div>
            </form>
          </Form>
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
                        <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => guideForm.reset(guideToForm(guide))}>
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
