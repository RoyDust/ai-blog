"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { ListSearchInput, LoadingStatus, MetricStrip, MotionTableRow, SkeletonTableRows, TableStateRow } from "@/components/admin/lists";
import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { Button } from "@/components/admin/ui";
import { EmptyState } from "@/components/editorial";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { Textarea } from "@/components/shadcn/ui/textarea";
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

const statusTone: Record<GuideStatus, "muted" | "success" | "warning"> = {
  draft: "warning",
  published: "success",
  archived: "muted",
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
    <div>
      <PageHeader
        eyebrow="内容编排"
        title="专题导读"
        description="把已发布文章编排成可连续阅读的导读路径。第一版使用确定顺序和编辑备注，不接入 AI 排序。"
        action={
          <Button asChild variant="outline">
            <Link href="/guides">前台预览</Link>
          </Button>
        }
      />

      <MetricStrip
        className="mt-1"
        items={[
          { key: "total", label: "专题", value: guides.length.toLocaleString("zh-CN"), note: "全部专题导读" },
          { key: "published", label: "已发布", value: guides.filter((guide) => guide.status === "published").length.toLocaleString("zh-CN"), note: "前台可见", tone: "success" },
          { key: "draft", label: "草稿", value: guides.filter((guide) => guide.status === "draft").length.toLocaleString("zh-CN"), note: "待完善后发布" },
          { key: "options", label: "可选文章", value: postOptions.length.toLocaleString("zh-CN"), note: "最近 50 篇已发布" },
        ]}
      />

      <section className="mt-6 grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <AdminSectionHeader
            aside={<span className="ed-mono">共 {filteredGuides.length} 个专题导读</span>}
            description="状态、文章顺序与发布操作"
            title="专题列表"
          />
          <Toolbar leading={<ListSearchInput ariaLabel="搜索专题导读" onChange={setQuery} placeholder="搜索标题或 slug" value={query} />} />
          <div aria-busy={loading || undefined} className="overflow-x-auto">
            {loading ? <LoadingStatus label="正在加载专题导读..." /> : null}
            <table className="w-full min-w-[640px] table-fixed caption-bottom text-sm" data-slot="table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[34%]">专题</TableHead>
                  <TableHead className="w-[72px]">状态</TableHead>
                  <TableHead>文章顺序</TableHead>
                  <TableHead className="w-[212px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows bars={["w-[70%]", "w-10", "w-[80%]", "w-40"]} rows={4} />
                ) : filteredGuides.length > 0 ? (
                  filteredGuides.map((guide) => (
                    <MotionTableRow key={guide.id}>
                      <TableCell className="overflow-hidden">
                        <span className="flex min-w-0 items-baseline gap-2" title={guide.description ?? undefined}>
                          <span className="shrink-0 font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{guide.title}</span>
                          <span className="min-w-0 truncate font-mono text-xs text-[var(--text-muted)]">/guides/{guide.slug}</span>
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={statusTone[guide.status]}>{statusLabels[guide.status]}</StatusBadge>
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        <span className="flex min-w-0 gap-3 truncate text-xs text-[var(--text-muted)]">
                          {guide.posts.slice(0, 4).map((item) => (
                            <span key={item.id} className="shrink-0">
                              {item.order}. {item.post.title}
                            </span>
                          ))}
                          {guide.posts.length > 4 ? <span className="shrink-0">另 {guide.posts.length - 4} 篇</span> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <button type="button" className={adminTextActionClassName} onClick={() => guideForm.reset(guideToForm(guide))}>
                            编辑
                          </button>
                          {guide.status !== "published" ? (
                            <button type="button" className={adminTextActionClassName} onClick={() => void patchGuideStatus(guide, "published")}>
                              发布
                            </button>
                          ) : (
                            <button type="button" className={adminTextActionClassName} onClick={() => void patchGuideStatus(guide, "draft")}>
                              下线
                            </button>
                          )}
                          {guide.status !== "archived" ? (
                            <button type="button" className={adminTextActionClassName} onClick={() => void patchGuideStatus(guide, "archived")}>
                              归档
                            </button>
                          ) : null}
                          <Link className={adminTextActionClassName} href={`/guides/${guide.slug}`}>
                            预览
                          </Link>
                          <button type="button" className={adminTextActionDangerClassName} onClick={() => void deleteGuide(guide)}>
                            删除
                          </button>
                        </span>
                      </TableCell>
                    </MotionTableRow>
                  ))
                ) : (
                  <TableStateRow colSpan={4}>
                    <EmptyState description={query.trim() ? "换个关键词再试。" : "在表单里新建第一个专题导读。"} role="status" title="暂无专题导读" />
                  </TableStateRow>
                )}
              </TableBody>
            </table>
          </div>
        </div>

        <EntityFormShell title={editingGuideId ? "编辑专题" : "新建专题"} description="选择已发布文章后，可用上移/下移调整阅读顺序。">
          <Form {...guideForm}>
            <form onSubmit={guideForm.handleSubmit(submitGuide)} className="space-y-4">
              <FormField
                control={guideForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input
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
                      <Input className="font-mono" {...field} onChange={(event) => field.onChange(toSlug(event.target.value))} />
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
                      <Textarea className="min-h-24" {...field} />
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
                      <select className="ed-select w-full" {...field}>
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
                    <div className="max-h-56 overflow-y-auto rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] px-2">
                      {postOptions.length > 0 ? postOptions.map((post) => (
                        <label key={post.id} className="flex cursor-pointer items-start gap-2.5 border-b border-[var(--border)] py-2 text-sm last:border-b-0">
                          <input
                            type="checkbox"
                            className="ed-checkbox mt-0.5"
                            checked={selectedPostIds.includes(post.id)}
                            onChange={() => togglePost(post)}
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-[var(--foreground)]">{post.title}</span>
                            <span className="block truncate font-mono text-xs text-[var(--text-muted)]">/posts/{post.slug}</span>
                          </span>
                        </label>
                      )) : (
                        <p className="py-4 text-sm text-[var(--text-muted)]">暂无可选文章</p>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

            {selectedPosts.length > 0 ? (
              <div>
                <h3 className="border-b border-[var(--reader-border-strong)] pb-1.5 text-xs font-bold text-[var(--text-muted)]">阅读顺序</h3>
                {selectedPosts.map((post, index) => (
                  <div key={post.id} className="border-b border-[var(--border)] py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--foreground)]"><span className="mr-1.5 font-mono text-[var(--text-muted)]">{String(index + 1).padStart(2, "0")}</span>{post.title}</p>
                        <p className="truncate font-mono text-xs text-[var(--text-muted)]">/posts/{post.slug}</p>
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
                      className="mt-2 min-h-16 w-full resize-y rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent px-2.5 py-2 text-base text-[var(--foreground)] transition-[border-color] duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] md:text-sm"
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
              <Button disabled={guideForm.formState.isSubmitting} type="submit">
                {guideForm.formState.isSubmitting ? "保存中..." : editingGuideId ? "保存专题" : "创建专题"}
              </Button>
              {editingGuideId ? (
                <Button disabled={guideForm.formState.isSubmitting} type="button" variant="outline" onClick={() => guideForm.reset(emptyForm)}>
                  取消编辑
                </Button>
              ) : null}
            </div>
            </form>
          </Form>
        </EntityFormShell>
      </section>
    </div>
  );
}
