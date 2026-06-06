"use client";

/**
 * 后台文章列表页。
 *
 * 职责：
 * - 展示文章列表、摘要状态、发布状态与基础统计
 * - 提供搜索、状态过滤、发布切换、删除、批量 AI 补全等操作
 * - 在摘要任务进行中时，周期性同步任务状态
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Heart,
  Loader2,
  MessageSquare,
  PencilLine,
  Search,
  Send,
  Sparkles,
  Trash2,
  WandSparkles,
  XCircle,
} from "lucide-react";

import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { BulkAiCompletionDialog } from "@/components/admin/ai/BulkAiCompletionDialog";
import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import { Checkbox } from "@/components/shadcn/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/ui/empty";
import { Input } from "@/components/shadcn/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/shadcn/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { Separator } from "@/components/shadcn/ui/separator";
import { Skeleton } from "@/components/shadcn/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";
import { getApiErrorMessage } from "@/lib/admin-api-client";
import { cn } from "@/lib/utils";
import {
  getSummaryStatusForExcerpt,
  isActiveSummaryStatus,
  type PostSummaryStatus,
} from "@/lib/post-summary-status";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  summaryStatus?: PostSummaryStatus | null;
  summaryError?: string | null;
  summaryGeneratedAt?: string | null;
  summaryJobId?: string | null;
  summaryModelId?: string | null;
  published: boolean;
  viewCount: number;
  createdAt: string;
  author: { name: string | null; email: string };
  _count: { comments: number; likes: number };
}

interface DeleteDialogState {
  open: boolean;
  ids: string[];
  title: string;
  description: string;
  impacts: DeleteImpactItem[];
  submitting: boolean;
}

const initialDeleteDialog: DeleteDialogState = {
  open: false,
  ids: [],
  title: "",
  description: "",
  impacts: [],
  submitting: false,
};

const defaultPageSize = 10;
const placeholder = "-";

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PostStats = {
  total: number;
  published: number;
  drafts: number;
  views: number;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";
type StatusFilter = "all" | "published" | "draft";
type ContentTypeFilter = "all" | "non-ai-daily";
type Tone = "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue";
type PostsFilterMemory = {
  query: string;
  statusFilter: StatusFilter;
  contentTypeFilter: ContentTypeFilter;
  page: number;
  pageSize: number;
};

const emptyPagination: PaginationState = {
  page: 1,
  limit: defaultPageSize,
  total: 0,
  totalPages: 1,
};

const emptyStats: PostStats = {
  total: 0,
  published: 0,
  drafts: 0,
  views: 0,
};

const postsFilterMemoryKey = "admin:posts:list-filters";
const statusFilters: StatusFilter[] = ["all", "published", "draft"];
const contentTypeFilters: ContentTypeFilter[] = ["all", "non-ai-daily"];
const pageSizeOptions = [10, 20, 50, 100];

const toneClassName: Record<Tone, string> = {
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
};

function readPositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function readPostsFilterMemory(): PostsFilterMemory {
  if (typeof window === "undefined") {
    return {
      query: "",
      statusFilter: "all",
      contentTypeFilter: "all",
      page: 1,
      pageSize: defaultPageSize,
    };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(postsFilterMemoryKey) ?? "{}") as Partial<PostsFilterMemory>;
    const nextPageSize = readPositiveInteger(parsed.pageSize, defaultPageSize);

    return {
      query: typeof parsed.query === "string" ? parsed.query : "",
      statusFilter: statusFilters.includes(parsed.statusFilter as StatusFilter) ? (parsed.statusFilter as StatusFilter) : "all",
      contentTypeFilter: contentTypeFilters.includes(parsed.contentTypeFilter as ContentTypeFilter) ? (parsed.contentTypeFilter as ContentTypeFilter) : "all",
      page: readPositiveInteger(parsed.page, 1),
      pageSize: pageSizeOptions.includes(nextPageSize) ? nextPageSize : defaultPageSize,
    };
  } catch {
    return {
      query: "",
      statusFilter: "all",
      contentTypeFilter: "all",
      page: 1,
      pageSize: defaultPageSize,
    };
  }
}

function writePostsFilterMemory(value: PostsFilterMemory) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(postsFilterMemoryKey, JSON.stringify(value));
  } catch {
    // localStorage can be unavailable in private or constrained browser contexts.
  }
}

function getSummaryStatus(post: PostRow): PostSummaryStatus {
  if (post.summaryStatus) {
    return post.summaryStatus;
  }

  return getSummaryStatusForExcerpt(post.excerpt);
}

function fallbackText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : placeholder;
}

function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN")
    : placeholder;
}

function formatDate(value: string | null | undefined) {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleDateString("zh-CN");
}

function clampPage(value: number, totalPages: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), Math.max(totalPages, 1));
}

function getPaginationItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}

function getSummaryMeta(status: PostSummaryStatus): { label: string; tone: Tone; icon: LucideIcon } {
  if (status === "QUEUED") return { label: "排队中", tone: "amber", icon: Clock3 };
  if (status === "GENERATING") return { label: "生成中", tone: "cyan", icon: Loader2 };
  if (status === "FAILED") return { label: "失败", tone: "rose", icon: XCircle };
  if (status === "GENERATED") return { label: "已生成", tone: "emerald", icon: Sparkles };
  return { label: "未生成", tone: "slate", icon: Bot };
}

function getPreviewHref(row: PostRow) {
  const slug = row.slug?.trim();
  if (!slug) return null;
  return row.published ? `/posts/${slug}` : `/admin/posts/preview/${slug}`;
}

function StatusPill({ tone, children, icon: Icon }: { tone: Tone; children: React.ReactNode; icon?: LucideIcon }) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md px-2 font-medium", toneClassName[tone])}>
      {Icon ? <Icon className={cn("size-3", Icon === Loader2 && "animate-spin")} /> : null}
      {children}
    </Badge>
  );
}

function PublishToggleTag({
  busy,
  onClick,
  published,
}: {
  busy: boolean;
  onClick: () => void;
  published: boolean;
}) {
  const Icon = busy ? Loader2 : published ? CheckCircle2 : Clock3;

  return (
    <Button
      aria-label={published ? "切换为草稿" : "切换为已发布"}
      className={cn(
        "h-7 gap-1 rounded-md border px-2 text-xs font-medium shadow-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1",
        toneClassName[published ? "emerald" : "amber"],
        published
          ? "hover:!border-emerald-300 hover:!bg-emerald-100 hover:!text-emerald-800"
          : "hover:!border-amber-300 hover:!bg-amber-100 hover:!text-amber-800",
      )}
      disabled={busy}
      onClick={onClick}
      size="xs"
      type="button"
      variant="outline"
    >
      <Icon className={cn("size-3.5", busy && "animate-spin")} />
      <span>{published ? "已发布" : "草稿"}</span>
      <span className="text-current/45">/</span>
      <span>{published ? "转草稿" : "发布"}</span>
    </Button>
  );
}

function MetricCard({
  active,
  icon: Icon,
  label,
  value,
  tone,
  caption,
  onClick,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: Tone;
  caption: string;
  onClick?: () => void;
}) {
  const valueText = typeof value === "number" ? formatNumber(value) : value;

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border-slate-200/80 bg-white py-0 shadow-none transition-colors",
        onClick && "cursor-pointer hover:border-slate-300 hover:bg-slate-50",
        active && "border-cyan-300 bg-cyan-50/60 ring-2 ring-cyan-200/70",
      )}
    >
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-950">{valueText}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{caption}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", toneClassName[tone])}>
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className={cn(
        "h-8 rounded-md px-3 text-xs",
        active
          ? "!border-slate-950 !bg-slate-950 !text-white hover:!bg-slate-800"
          : "!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50",
      )}
      onClick={onClick}
      type="button"
      variant={active ? "default" : "outline"}
    >
      {children}
    </Button>
  );
}

function IconAction({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

function PaginationBar({
  disabled,
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pagination: PaginationState;
}) {
  const activePage = clampPage(pagination.page, pagination.totalPages);
  const pageItems = getPaginationItems(activePage, Math.max(pagination.totalPages, 1));
  const firstItem = pagination.total === 0 ? 0 : (activePage - 1) * pagination.limit + 1;
  const lastItem = Math.min(activePage * pagination.limit, pagination.total);
  const [jumpValue, setJumpValue] = useState(String(activePage));

  useEffect(() => {
    setJumpValue(String(activePage));
  }, [activePage]);

  const goToPage = (nextPage: number) => {
    const targetPage = clampPage(nextPage, pagination.totalPages);
    if (disabled || targetPage === activePage) return;
    onPageChange(targetPage);
  };

  return (
    <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600 xl:flex-row xl:items-center xl:justify-between">
      <p>
        显示第 {firstItem} 到 {lastItem} 条，共 {formatNumber(pagination.total)} 条记录
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <label className="flex items-center gap-2">
          每页
          <Select
            disabled={disabled}
            value={String(pagination.limit)}
            onValueChange={(value) => {
              const nextPageSize = Number(value);
              if (Number.isInteger(nextPageSize) && nextPageSize > 0 && nextPageSize !== pagination.limit) {
                onPageSizeChange(nextPageSize);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[82px] rounded-md !border-slate-200 !bg-white !text-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-slate-200 bg-white text-slate-700">
              {[10, 20, 50, 100].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {pagination.totalPages > 1 ? (
          <Pagination className="mx-0 w-auto justify-start sm:justify-center" aria-label="分页">
            <PaginationContent>
              <PaginationItem>
                <Button
                  aria-label="上一页"
                  className="size-8 rounded-md !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"
                  disabled={disabled || activePage <= 1}
                  onClick={() => goToPage(activePage - 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <span aria-hidden>‹</span>
                </Button>
              </PaginationItem>
              {pageItems.map((pageItem) => (
                <PaginationItem key={pageItem}>
                  {typeof pageItem === "number" ? (
                    <Button
                      aria-current={pageItem === activePage ? "page" : undefined}
                      aria-label={`第 ${pageItem} 页`}
                      className={cn(
                        "size-8 rounded-md !text-slate-700 hover:!bg-slate-50",
                        pageItem === activePage
                          ? "!bg-slate-950 !text-white hover:!bg-slate-900"
                          : "!bg-white",
                      )}
                      disabled={disabled || pageItem === activePage}
                      onClick={() => goToPage(pageItem)}
                      size="icon-sm"
                      type="button"
                      variant={pageItem === activePage ? "default" : "ghost"}
                    >
                      {pageItem}
                    </Button>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <Button
                  aria-label="下一页"
                  className="size-8 rounded-md !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"
                  disabled={disabled || activePage >= pagination.totalPages}
                  onClick={() => goToPage(activePage + 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <span aria-hidden>›</span>
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}

        {pagination.totalPages > 1 ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              goToPage(Number(jumpValue));
            }}
          >
            跳至
            <Input
              aria-label="跳转页码"
              className="h-8 w-16 rounded-md !bg-white px-2 text-center !text-slate-700"
              disabled={disabled}
              inputMode="numeric"
              max={pagination.totalPages}
              min={1}
              onChange={(event) => setJumpValue(event.target.value)}
              type="number"
              value={jumpValue}
            />
            页
            <Button className="h-8 rounded-md !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50" disabled={disabled} size="sm" type="submit" variant="outline">
              跳转
            </Button>
          </form>
        ) : null}
      </div>
    </footer>
  );
}

/**
 * 后台文章管理主页面。
 * 这里负责协调列表数据、批量操作弹窗与行级异步动作状态。
 */
export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(emptyPagination);
  const [stats, setStats] = useState<PostStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [busyRowIds, setBusyRowIds] = useState<string[]>([]);
  const [bulkPublishAction, setBulkPublishAction] = useState<"publish" | "draft" | null>(null);
  const [bulkAiIds, setBulkAiIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);
  const [filtersRestored, setFiltersRestored] = useState(false);

  const fetchPosts = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!filtersRestored) {
      return;
    }

    try {
      if (!options.silent) {
        setLoading(true);
      }
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      const keyword = debouncedQuery.trim();
      if (keyword) params.set("q", keyword);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (contentTypeFilter !== "all") params.set("type", contentTypeFilter);

      const res = await fetch(`/api/admin/posts?${params.toString()}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        const nextPagination = data.pagination ?? {
          page,
          limit: pageSize,
          total: data.data.length,
          totalPages: Math.max(1, Math.ceil(data.data.length / pageSize)),
        };
        setPosts(data.data);
        setPagination(nextPagination);
        setStats(data.stats ?? emptyStats);
        if (nextPagination.page !== page) {
          setPage(nextPagination.page);
        }
        return;
      }

      toast.error(getApiErrorMessage(data, "文章列表加载失败"));
      setPosts([]);
      setPagination({ ...emptyPagination, limit: pageSize });
      setStats(emptyStats);
    } catch {
      toast.error("文章列表加载失败，请稍后重试");
      setPosts([]);
      setPagination({ ...emptyPagination, limit: pageSize });
      setStats(emptyStats);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [contentTypeFilter, debouncedQuery, filtersRestored, page, pageSize, statusFilter]);

  useEffect(() => {
    const saved = readPostsFilterMemory();
    setQuery(saved.query);
    setDebouncedQuery(saved.query);
    setStatusFilter(saved.statusFilter);
    setContentTypeFilter(saved.contentTypeFilter);
    setPage(saved.page);
    setPageSize(saved.pageSize);
    setFiltersRestored(true);
  }, []);

  useEffect(() => {
    if (!filtersRestored) {
      return;
    }

    writePostsFilterMemory({
      query,
      statusFilter,
      contentTypeFilter,
      page,
      pageSize,
    });
  }, [contentTypeFilter, filtersRestored, page, pageSize, query, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    setSelectedIds((current) => current.filter((id) => posts.some((post) => post.id === id)));
  }, [posts]);

  const activeSummaryIds = useMemo(
    () => posts.filter((post) => isActiveSummaryStatus(getSummaryStatus(post))).map((post) => post.id),
    [posts],
  );

  const summaryReadyCount = useMemo(
    () => posts.filter((post) => {
      const status = getSummaryStatus(post);
      return status === "GENERATED";
    }).length,
    [posts],
  );

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => posts.some((post) => post.id === id)),
    [posts, selectedIds],
  );
  const currentPageIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => visibleSelectedIds.includes(id));
  const isCurrentPagePartiallySelected = !allCurrentPageSelected && currentPageIds.some((id) => visibleSelectedIds.includes(id));
  const headerCheckboxState = allCurrentPageSelected ? true : isCurrentPagePartiallySelected ? "indeterminate" : false;

  const syncSummaryJobs = useCallback(async () => {
    try {
      await fetch("/api/admin/posts/summarize/bulk?resume=1");
      await fetchPosts({ silent: true });
    } catch {
      toast.error("摘要任务状态同步失败");
    }
  }, [fetchPosts]);

  useEffect(() => {
    if (activeSummaryIds.length === 0) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        await fetch("/api/admin/posts/summarize/bulk?resume=1");
        if (!cancelled) {
          await fetchPosts({ silent: true });
        }
      } catch {
        if (!cancelled) {
          toast.error("摘要任务状态同步失败");
        }
      }
    };
    const timer = window.setInterval(() => {
      void sync();
    }, 2500);

    void sync();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSummaryIds.length, fetchPosts]);

  function toggleAllCurrentPage(checked: boolean) {
    if (checked) {
      setSelectedIds((current) => Array.from(new Set([...current, ...currentPageIds])));
      return;
    }

    setSelectedIds((current) => current.filter((id) => !currentPageIds.includes(id)));
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((current) => {
      if (checked) return Array.from(new Set([...current, id]));
      return current.filter((item) => item !== id);
    });
  }

  async function openDeleteDialog(ids: string[]) {
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const res = await fetch(`/api/admin/posts?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(getApiErrorMessage(data, "删除影响预览加载失败"));
        return;
      }

      setDeleteDialog({
        open: true,
        ids,
        title: data.data.title,
        description: data.data.description,
        impacts: data.data.impacts,
        submitting: false,
      });
    } catch {
      toast.error("删除影响预览加载失败，请稍后重试");
    }
  }

  async function confirmDelete() {
    try {
      setDeleteDialog((prev) => ({ ...prev, submitting: true }));
      const params = new URLSearchParams({ ids: deleteDialog.ids.join(",") });
      const res = await fetch(`/api/admin/posts?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setDeleteDialog(initialDeleteDialog);
        setSelectedIds((current) => current.filter((id) => !deleteDialog.ids.includes(id)));
        toast.success(deleteDialog.ids.length > 1 ? `已删除 ${deleteDialog.ids.length} 篇文章` : "文章已删除");
        void fetchPosts({ silent: true });
        return;
      }

      toast.error(getApiErrorMessage(data, "删除文章失败"));
    } catch {
      toast.error("删除文章失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  async function togglePublish(row: PostRow) {
    if (busyRowIds.includes(row.id)) {
      return;
    }

    const nextPublished = !row.published;
    setBusyRowIds((prev) => [...prev, row.id]);
    setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: nextPublished } : item)));

    try {
      const res = await fetch("/api/admin/posts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, published: nextPublished }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(getApiErrorMessage(data, "更新发布状态失败"));
      }

      toast.success(nextPublished ? "文章已发布" : "已转为草稿");
      void fetchPosts({ silent: true });
    } catch (error) {
      setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: row.published } : item)));
      toast.error(error instanceof Error ? error.message : "更新发布状态失败");
    } finally {
      setBusyRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  }

  async function updateBulkPublish(ids: string[], published: boolean) {
    if (bulkPublishAction) {
      return;
    }

    const targetRows = posts.filter((post) => ids.includes(post.id) && post.published !== published);
    const targetIds = targetRows.map((post) => post.id);

    if (targetIds.length === 0) {
      toast.info(published ? "所选文章已全部发布" : "所选文章已全部是草稿");
      return;
    }

    const previousPosts = posts;
    const action = published ? "publish" : "draft";
    setBulkPublishAction(action);
    setBusyRowIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    setPosts((prev) => prev.map((item) => (targetIds.includes(item.id) ? { ...item, published } : item)));

    try {
      const res = await fetch("/api/admin/posts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds, published }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(getApiErrorMessage(data, published ? "批量发布失败" : "批量转草稿失败"));
      }

      const count = data.data?.count ?? targetIds.length;
      toast.success(published ? `已发布 ${count} 篇文章` : `已将 ${count} 篇文章转为草稿`);
      void fetchPosts({ silent: true });
    } catch (error) {
      setPosts(previousPosts);
      toast.error(error instanceof Error ? error.message : published ? "批量发布失败" : "批量转草稿失败");
    } finally {
      setBulkPublishAction(null);
      setBusyRowIds((prev) => prev.filter((id) => !targetIds.includes(id)));
    }
  }

  const handleStatusFilter = (nextFilter: StatusFilter) => {
    setStatusFilter(nextFilter);
    setPage(1);
  };

  const handleContentTypeFilter = (nextFilter: ContentTypeFilter) => {
    setContentTypeFilter(nextFilter);
    setPage(1);
  };

  const hasSelection = visibleSelectedIds.length > 0;

  return (
    <>
      <TooltipProvider>
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden rounded-lg bg-[#f5f7f4] p-3 text-slate-950">
          <section className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-none">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="h-6 rounded-md border-cyan-200 bg-cyan-50 px-2 text-cyan-700">
                    <Bot className="size-3" />
                    AI OPS
                  </Badge>
                  <Badge variant="outline" className="h-6 rounded-md border-slate-200 bg-slate-50 px-2 text-slate-600">
                    当前页 {formatNumber(posts.length)}
                  </Badge>
                  {activeSummaryIds.length > 0 ? (
                    <StatusPill tone="amber" icon={Clock3}>{activeSummaryIds.length} 篇处理中</StatusPill>
                  ) : null}
                  {bulkPublishAction ? (
                    <StatusPill tone="cyan" icon={Loader2}>{bulkPublishAction === "publish" ? "批量发布中" : "批量转草稿中"}</StatusPill>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-1">
                  <h1 className="font-display text-2xl font-semibold tracking-normal text-slate-950">
                    AI 内容队列
                  </h1>
                  <p className="pb-1 text-sm text-slate-500">
                    {formatNumber(pagination.total)} 篇内容
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="h-8 rounded-md bg-slate-950 text-white hover:bg-slate-800" size="sm">
                  <Link href="/admin/posts/new">
                    <PencilLine className="size-4" />
                    新建文章
                  </Link>
                </Button>
              </div>
            </div>
          </section>

          <section className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-5">
            <MetricCard
              active={statusFilter === "all"}
              caption="总内容池"
              icon={FileText}
              label="全部"
              onClick={() => handleStatusFilter("all")}
              tone="blue"
              value={stats.total}
            />
            <MetricCard
              active={statusFilter === "published"}
              caption="线上可见"
              icon={Send}
              label="已发布"
              onClick={() => handleStatusFilter("published")}
              tone="emerald"
              value={stats.published}
            />
            <MetricCard
              active={statusFilter === "draft"}
              caption="待校稿"
              icon={PencilLine}
              label="草稿"
              onClick={() => handleStatusFilter("draft")}
              tone="amber"
              value={stats.drafts}
            />
            <MetricCard
              caption="累计阅读"
              icon={Eye}
              label="阅读"
              tone="cyan"
              value={stats.views}
            />
            <MetricCard
              caption="当前页摘要"
              icon={WandSparkles}
              label="AI 就绪"
              tone={activeSummaryIds.length > 0 ? "amber" : "emerald"}
              value={`${formatNumber(summaryReadyCount)}/${formatNumber(posts.length)}`}
            />
          </section>

          <Card className="shrink-0 rounded-lg border-slate-200 bg-white py-0 shadow-none">
            <CardContent className="flex flex-col gap-3 p-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
                <label className="relative min-w-[240px] flex-1 md:max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    aria-label="搜索文章"
                    className="h-9 rounded-md !border-slate-200 !bg-slate-50 pl-9 text-sm !text-slate-950 shadow-none placeholder:!text-slate-400"
                    placeholder="搜索标题或 slug"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilter("all")}>全部内容</FilterButton>
                  <FilterButton active={statusFilter === "draft"} onClick={() => handleStatusFilter("draft")}>仅看草稿</FilterButton>
                  <FilterButton active={statusFilter === "published"} onClick={() => handleStatusFilter("published")}>已发布</FilterButton>
                  <Separator orientation="vertical" className="hidden h-4 md:block" />
                  <FilterButton active={contentTypeFilter === "non-ai-daily"} onClick={() => handleContentTypeFilter(contentTypeFilter === "non-ai-daily" ? "all" : "non-ai-daily")}>
                    非 AI 日报
                  </FilterButton>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="h-8 rounded-md border-slate-200 bg-slate-50 px-2.5 text-slate-600">
                  已选 {formatNumber(visibleSelectedIds.length)}
                </Badge>
                <Button
                  className="h-8 rounded-md !border-cyan-200 !bg-cyan-50 px-3 !text-cyan-700 hover:!bg-cyan-100"
                  disabled={!hasSelection || bulkPublishAction !== null}
                  onClick={() => setBulkAiIds(visibleSelectedIds)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Sparkles className="size-4" />
                  AI 批量补全
                </Button>
                <Button
                  className="h-8 rounded-md !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"
                  disabled={!hasSelection || bulkPublishAction !== null}
                  onClick={() => void updateBulkPublish(visibleSelectedIds, true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  批量发布
                </Button>
                <Button
                  className="h-8 rounded-md !border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50"
                  disabled={!hasSelection || bulkPublishAction !== null}
                  onClick={() => void updateBulkPublish(visibleSelectedIds, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  批量转草稿
                </Button>
                <Button
                  className="h-8 rounded-md"
                  disabled={!hasSelection || bulkPublishAction !== null}
                  onClick={() => void openDeleteDialog(visibleSelectedIds)}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  批量删除
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-slate-200 bg-white py-0 shadow-none">
            <CardHeader className="shrink-0 gap-0 border-b border-slate-200 px-4 py-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base font-semibold text-slate-950">文章列表</CardTitle>
                  <p className="mt-1 text-xs text-slate-500">发布状态、AI 摘要和数据上下文</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="font-mono tabular-nums">PAGE {formatNumber(pagination.page)} / {formatNumber(pagination.totalPages)}</span>
                  <Separator orientation="vertical" className="hidden h-4 md:block" />
                  <span>{formatNumber(posts.length)} rows</span>
                </div>
              </div>
            </CardHeader>

            <div className="min-h-0 flex-1 overflow-auto" data-testid="admin-data-table-scroll">
              <Table className="min-w-[860px] table-fixed xl:min-w-[1160px] 2xl:min-w-[1220px]">
                <TableHeader className="sticky top-0 z-10 border-b border-slate-200 bg-[#f8faf8] shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="w-12 px-4">
                      <Checkbox
                        aria-label="选择当前页"
                        className="!border-slate-300 !bg-white data-[state=checked]:!border-cyan-600 data-[state=checked]:!bg-cyan-600 data-[state=indeterminate]:!border-cyan-600 data-[state=indeterminate]:!bg-cyan-600"
                        checked={headerCheckboxState}
                        disabled={loading || posts.length === 0}
                        onCheckedChange={(checked) => toggleAllCurrentPage(checked === true)}
                      />
                    </TableHead>
                    <TableHead className="w-[34%] text-xs uppercase tracking-wide text-slate-500 xl:w-[30%]">标题</TableHead>
                    <TableHead className="hidden w-[13%] text-xs uppercase tracking-wide text-slate-500 xl:table-cell">作者</TableHead>
                    <TableHead className="w-[32%] text-xs uppercase tracking-wide text-slate-500 xl:w-[24%]">AI 摘要</TableHead>
                    <TableHead className="w-[148px] text-xs uppercase tracking-wide text-slate-500">发布</TableHead>
                    <TableHead className="hidden w-[13%] pl-6 text-xs uppercase tracking-wide text-slate-500 2xl:table-cell">上下文</TableHead>
                    <TableHead className="hidden w-[10%] text-xs uppercase tracking-wide text-slate-500 xl:table-cell">日期</TableHead>
                    <TableHead className="w-[104px] text-right text-xs uppercase tracking-wide text-slate-500">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 6 }, (_, index) => (
                      <TableRow key={index} className="border-slate-100">
                        <TableCell className="px-4"><Skeleton className="size-4" /></TableCell>
                        <TableCell><Skeleton className="h-9 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-full" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                        <TableCell><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                      </TableRow>
                    ))
                  ) : posts.length === 0 ? (
                    <TableRow>
                      <TableCell className="h-80 whitespace-normal" colSpan={8}>
                        <Empty className="border-0">
                          <EmptyMedia variant="icon">
                            <FileText className="size-5" />
                          </EmptyMedia>
                          <EmptyHeader>
                            <EmptyTitle>暂无文章</EmptyTitle>
                            <EmptyDescription>当前筛选条件下没有内容。</EmptyDescription>
                          </EmptyHeader>
                        </Empty>
                      </TableCell>
                    </TableRow>
                  ) : (
                    posts.map((row) => {
                      const summaryStatus = getSummaryStatus(row);
                      const summaryMeta = getSummaryMeta(summaryStatus);
                      const isSelected = visibleSelectedIds.includes(row.id);
                      const authorName = fallbackText(row.author?.name || row.author?.email);
                      const authorEmail = row.author?.email?.trim();
                      const previewHref = getPreviewHref(row);
                      const titleText = fallbackText(row.title);
                      const slugText = row.slug?.trim() ? `/posts/${row.slug}` : placeholder;
                      const summaryText = summaryStatus === "FAILED"
                        ? fallbackText(row.summaryError || row.excerpt)
                        : fallbackText(row.excerpt);

                      return (
                        <TableRow
                          key={row.id}
                          className={cn(
                            "border-slate-100 transition-colors hover:bg-slate-50/80",
                            isSelected && "bg-cyan-50/70 hover:bg-cyan-50",
                          )}
                        >
                          <TableCell className="px-4 align-top">
                            <Checkbox
                              aria-label={`选择 ${row.id}`}
                              className="!border-slate-300 !bg-white data-[state=checked]:!border-cyan-600 data-[state=checked]:!bg-cyan-600"
                              checked={isSelected}
                              onCheckedChange={(checked) => toggleOne(row.id, checked === true)}
                            />
                          </TableCell>
                          <TableCell className="whitespace-normal align-top">
                            <div className="min-w-0 space-y-1">
                              <Link className="line-clamp-1 font-medium text-slate-950 hover:text-cyan-700" href={`/admin/posts/${row.id}/edit`}>
                                {titleText}
                              </Link>
                              <p className="line-clamp-1 font-mono text-xs text-slate-500">{slugText}</p>
                              <p className="line-clamp-1 text-xs text-slate-500 xl:hidden">
                                {authorName} / {formatDate(row.createdAt)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="hidden whitespace-normal align-top xl:table-cell">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-700">{authorName}</p>
                              {authorEmail && authorEmail !== authorName ? (
                                <p className="mt-1 truncate text-xs text-slate-500">{authorEmail}</p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal align-top">
                            <div className="max-w-[300px] space-y-1.5">
                              <StatusPill tone={summaryMeta.tone} icon={summaryMeta.icon}>{summaryMeta.label}</StatusPill>
                              <p className={cn("line-clamp-2 text-xs leading-5 text-slate-500", summaryStatus === "FAILED" && "text-rose-600")}>
                                {summaryText}
                              </p>
                              <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-500 2xl:hidden">
                                <span>阅读 {formatNumber(row.viewCount)}</span>
                                <span>评论 {formatNumber(row._count?.comments)}</span>
                                <span>点赞 {formatNumber(row._count?.likes)}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-normal align-top">
                            <PublishToggleTag
                              busy={busyRowIds.includes(row.id)}
                              onClick={() => void togglePublish(row)}
                              published={row.published}
                            />
                          </TableCell>
                          <TableCell className="hidden whitespace-normal pl-6 align-top 2xl:table-cell">
                            <div className="grid gap-1 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5"><Eye className="size-3.5" />阅读 {formatNumber(row.viewCount)}</span>
                              <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5" />评论 {formatNumber(row._count?.comments)}</span>
                              <span className="flex items-center gap-1.5"><Heart className="size-3.5" />点赞 {formatNumber(row._count?.likes)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden align-top font-mono text-xs tabular-nums text-slate-500 xl:table-cell">
                            {formatDate(row.createdAt)}
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="flex justify-end gap-1">
                              <IconAction label="编辑">
                                <Button asChild aria-label="编辑" className="size-8 rounded-md !text-slate-600 hover:!bg-slate-50 hover:!text-cyan-700" size="icon-sm" variant="ghost">
                                  <Link href={`/admin/posts/${row.id}/edit`}>
                                    <PencilLine className="size-4" />
                                  </Link>
                                </Button>
                              </IconAction>
                              {previewHref ? (
                                <IconAction label="预览">
                                  <Button asChild aria-label="预览" className="size-8 rounded-md !text-slate-600 hover:!bg-slate-50 hover:!text-cyan-700" size="icon-sm" variant="ghost">
                                    <Link href={previewHref}>
                                      <Eye className="size-4" />
                                    </Link>
                                  </Button>
                                </IconAction>
                              ) : (
                                <IconAction label="缺少 slug">
                                  <Button aria-label="预览" className="size-8 rounded-md !text-slate-400" disabled size="icon-sm" type="button" variant="ghost">
                                    <Eye className="size-4" />
                                  </Button>
                                </IconAction>
                              )}
                              <IconAction label="删除">
                                <Button
                                  aria-label="删除"
                                  className="size-8 rounded-md !text-rose-600 hover:!bg-rose-50 hover:!text-rose-700"
                                  onClick={() => void openDeleteDialog([row.id])}
                                  size="icon-sm"
                                  type="button"
                                  variant="ghost"
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </IconAction>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!loading && posts.length > 0 ? (
              <PaginationBar
                disabled={loading}
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                pagination={pagination}
              />
            ) : null}
          </Card>
        </div>
      </TooltipProvider>

      <DeleteImpactDialog
        confirmLabel="确认删除"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog(open ? deleteDialog : initialDeleteDialog)}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />

      <BulkAiCompletionDialog
        open={bulkAiIds.length > 0}
        selectedIds={bulkAiIds}
        onClose={() => setBulkAiIds([])}
        onStarted={(taskId) => {
          void fetch(`/api/admin/ai/batch?resume=1&taskId=${encodeURIComponent(taskId)}`);
          void fetchPosts();
          void syncSummaryJobs();
        }}
      />
    </>
  );
}
