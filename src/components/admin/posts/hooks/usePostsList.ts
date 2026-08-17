"use client";

/**
 * 后台文章列表数据层 hook。
 *
 * 职责：
 * - 列表查询（SWR）、筛选与分页状态、筛选记忆（localStorage）
 * - 行级发布切换、批量发布/转草稿、删除影响预览与确认删除
 * - AI 摘要任务轮询同步（refreshInterval）
 *
 * 约定：所有 setState 只发生在事件回调或渲染期条件调整中（不在 effect 体内），
 * 数据请求统一走 @/lib/client-api。
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";
import { getApiErrorMessage } from "@/lib/admin-api-client";
import { getSummaryStatusForExcerpt, isActiveSummaryStatus, type PostSummaryStatus } from "@/lib/post-summary-status";
import type { DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";

export interface PostRow {
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

export interface DeleteDialogState {
  open: boolean;
  ids: string[];
  title: string;
  description: string;
  impacts: DeleteImpactItem[];
  submitting: boolean;
}

export interface PublishDialogState {
  open: boolean;
  row: PostRow | null;
  submitting: boolean;
}

export interface BulkPublishDialogState {
  open: boolean;
  ids: string[];
  count: number;
  submitting: boolean;
}

export type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type PostStats = {
  total: number;
  published: number;
  drafts: number;
  views: number;
};

export type StatusFilter = "all" | "published" | "draft";
export type ContentTypeFilter = "all" | "non-ai-daily";

type PostsFilterMemory = {
  query: string;
  statusFilter: StatusFilter;
  contentTypeFilter: ContentTypeFilter;
  page: number;
  pageSize: number;
};

type AdminPostsResponse = {
  success: boolean;
  data: PostRow[];
  pagination: PaginationState;
  stats: PostStats;
};

export const initialDeleteDialog: DeleteDialogState = {
  open: false,
  ids: [],
  title: "",
  description: "",
  impacts: [],
  submitting: false,
};

export const initialPublishDialog: PublishDialogState = {
  open: false,
  row: null,
  submitting: false,
};

export const initialBulkPublishDialog: BulkPublishDialogState = {
  open: false,
  ids: [],
  count: 0,
  submitting: false,
};

export const defaultPageSize = 10;
export const statusFilters: StatusFilter[] = ["all", "published", "draft"];
export const contentTypeFilters: ContentTypeFilter[] = ["all", "non-ai-daily"];
export const pageSizeOptions = [10, 20, 50, 100];

export const emptyPagination: PaginationState = {
  page: 1,
  limit: defaultPageSize,
  total: 0,
  totalPages: 1,
};

export const emptyStats: PostStats = {
  total: 0,
  published: 0,
  drafts: 0,
  views: 0,
};

const postsFilterMemoryKey = "admin:posts:list-filters";
const SUMMARY_POLL_INTERVAL_MS = 2500;

function readPositiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function readPostsFilterMemory(): PostsFilterMemory {
  if (typeof window === "undefined") {
    return { query: "", statusFilter: "all", contentTypeFilter: "all", page: 1, pageSize: defaultPageSize };
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
    return { query: "", statusFilter: "all", contentTypeFilter: "all", page: 1, pageSize: defaultPageSize };
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

export function getSummaryStatus(post: PostRow): PostSummaryStatus {
  if (post.summaryStatus) {
    return post.summaryStatus;
  }

  return getSummaryStatusForExcerpt(post.excerpt);
}

export function usePostsList() {
  // 筛选记忆用惰性初始化读入，免去"先空载后恢复"的两段式状态
  const [initialMemory] = useState(readPostsFilterMemory);
  const [query, setQuery] = useState(initialMemory.query);
  const deferredQuery = useDeferredValue(query);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialMemory.statusFilter);
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>(initialMemory.contentTypeFilter);
  const [page, setPage] = useState(initialMemory.page);
  const [pageSize, setPageSize] = useState(initialMemory.pageSize);
  const [busyRowIds, setBusyRowIds] = useState<string[]>([]);
  const [bulkPublishAction, setBulkPublishAction] = useState<"publish" | "draft" | null>(null);
  const [bulkAiIds, setBulkAiIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);
  const [publishDialog, setPublishDialog] = useState<PublishDialogState>(initialPublishDialog);
  const [bulkPublishDialog, setBulkPublishDialog] = useState<BulkPublishDialogState>(initialBulkPublishDialog);

  const buildPostsUrl = useCallback(
    (pageNumber: number) => {
      const params = new URLSearchParams({
        page: String(pageNumber),
        limit: String(pageSize),
      });
      const keyword = deferredQuery.trim();
      if (keyword) params.set("q", keyword);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (contentTypeFilter !== "all") params.set("type", contentTypeFilter);
      return `/api/admin/posts?${params.toString()}`;
    },
    [contentTypeFilter, deferredQuery, pageSize, statusFilter],
  );

  const {
    data: postsResponse,
    isLoading,
    isValidating,
    mutate: mutateList,
  } = useSWR<AdminPostsResponse>(buildPostsUrl(page), apiFetcher, {
    keepPreviousData: true,
    // 挂载时强制后台重验证：保证切页/刷新拿到最新列表
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key);
      toast.error(toErrorMessage(swrError, "文章列表加载失败，请稍后重试"));
    },
  });

  const posts = useMemo(() => postsResponse?.data ?? [], [postsResponse?.data]);
  const pagination = postsResponse?.pagination ?? {
    page,
    limit: pageSize,
    total: posts.length,
    totalPages: Math.max(1, Math.ceil(posts.length / pageSize)),
  };
  const stats = postsResponse?.stats ?? emptyStats;

  // 服务端校正页码时同步回状态（渲染期条件调整，仅在真实响应到达后；
  // keepPreviousData 下旧响应会先于新响应出现，isValidating 期间不校正，避免翻页被旧页码拉回）
  if (postsResponse?.pagination && !isValidating && postsResponse.pagination.page !== page) {
    setPage(postsResponse.pagination.page);
  }

  // 筛选记忆持久化（纯副作用，无 setState）
  useEffect(() => {
    writePostsFilterMemory({
      query,
      statusFilter,
      contentTypeFilter,
      page,
      pageSize,
    });
  }, [contentTypeFilter, page, pageSize, query, statusFilter]);

  const activeSummaryIds = useMemo(
    () => posts.filter((post) => isActiveSummaryStatus(getSummaryStatus(post))).map((post) => post.id),
    [posts],
  );

  const summaryReadyCount = useMemo(
    () =>
      posts.filter((post) => {
        return getSummaryStatus(post) === "GENERATED";
      }).length,
    [posts],
  );

  // 摘要任务轮询：有活跃任务时每 2.5s 触发一次 resume 并静默刷新列表
  const shouldPollSummary = activeSummaryIds.length > 0;
  const { mutate: resumeSummaryJobs } = useSWR(
    shouldPollSummary ? "/api/admin/posts/summarize/bulk?resume=1" : null,
    apiFetcher,
    {
      refreshInterval: SUMMARY_POLL_INTERVAL_MS,
      onSuccess: () => {
        void mutateList();
      },
    },
  );

  const syncSummaryJobs = useCallback(async () => {
    try {
      await resumeSummaryJobs();
      await mutateList();
    } catch {
      toast.error("摘要任务状态同步失败");
    }
  }, [mutateList, resumeSummaryJobs]);

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => posts.some((post) => post.id === id)),
    [posts, selectedIds],
  );
  const currentPageIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => visibleSelectedIds.includes(id));
  const isCurrentPagePartiallySelected = !allCurrentPageSelected && currentPageIds.some((id) => visibleSelectedIds.includes(id));
  const headerCheckboxState: boolean | "indeterminate" = allCurrentPageSelected ? true : isCurrentPagePartiallySelected ? "indeterminate" : false;
  const hasSelection = visibleSelectedIds.length > 0;

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
      const data = await apiMutate<{ success: boolean; data?: DeleteDialogState }>(`/api/admin/posts?${params.toString()}`);

      if (!data.success || !data.data) {
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
    } catch (error) {
      toast.error(toErrorMessage(error, "删除影响预览加载失败，请稍后重试"));
    }
  }

  async function confirmDelete() {
    try {
      setDeleteDialog((prev) => ({ ...prev, submitting: true }));
      const params = new URLSearchParams({ ids: deleteDialog.ids.join(",") });
      await apiMutate(`/api/admin/posts?${params.toString()}`, { method: "DELETE" });

      setDeleteDialog(initialDeleteDialog);
      setSelectedIds((current) => current.filter((id) => !deleteDialog.ids.includes(id)));
      toast.success(deleteDialog.ids.length > 1 ? `已删除 ${deleteDialog.ids.length} 篇文章` : "文章已删除");
      void mutateList();
    } catch (error) {
      toast.error(toErrorMessage(error, "删除文章失败，请稍后重试"));
      setDeleteDialog((prev) => ({ ...prev, submitting: false }));
    }
  }

  async function togglePublish(row: PostRow) {
    if (busyRowIds.includes(row.id)) {
      return;
    }

    const nextPublished = !row.published;
    setBusyRowIds((prev) => [...prev, row.id]);

    try {
      await apiMutate("/api/admin/posts/publish", {
        method: "PATCH",
        body: JSON.stringify({ id: row.id, published: nextPublished }),
      });
      toast.success(nextPublished ? "文章已发布" : "已转为草稿");
      void mutateList();
    } catch (error) {
      toast.error(toErrorMessage(error, "更新发布状态失败"));
    } finally {
      setBusyRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  }

  /**
   * 行级发布入口：仅「发布」方向挂起确认（nextPublished === true），
   * 「转草稿」方向保持一键调用并 toast 反馈。
   */
  function requestTogglePublish(row: PostRow) {
    if (busyRowIds.includes(row.id)) {
      return;
    }

    const nextPublished = !row.published;
    if (!nextPublished) {
      void togglePublish(row);
      return;
    }

    setPublishDialog({ open: true, row, submitting: false });
  }

  async function confirmTogglePublish() {
    const row = publishDialog.row;
    if (!row || publishDialog.submitting) {
      return;
    }

    setPublishDialog((prev) => ({ ...prev, submitting: true }));
    try {
      await togglePublish(row);
    } finally {
      setPublishDialog(initialPublishDialog);
    }
  }

  function cancelTogglePublish() {
    if (publishDialog.submitting) {
      return;
    }
    setPublishDialog(initialPublishDialog);
  }

  /**
   * 批量发布入口：发布方向先弹确认（展示受影响篇数），转草稿方向直接调用。
   */
  function requestBulkPublish(ids: string[], published: boolean) {
    if (bulkPublishAction) {
      return;
    }

    const targetRows = posts.filter((post) => ids.includes(post.id) && post.published !== published);
    const targetIds = targetRows.map((post) => post.id);

    if (targetIds.length === 0) {
      toast.info(published ? "所选文章已全部发布" : "所选文章已全部是草稿");
      return;
    }

    if (!published) {
      void updateBulkPublish(ids, false);
      return;
    }

    setBulkPublishDialog({ open: true, ids: targetIds, count: targetIds.length, submitting: false });
  }

  async function confirmBulkPublish() {
    if (bulkPublishAction || bulkPublishDialog.submitting) {
      return;
    }

    setBulkPublishDialog((prev) => ({ ...prev, submitting: true }));
    try {
      await updateBulkPublish(bulkPublishDialog.ids, true, true);
    } finally {
      setBulkPublishDialog(initialBulkPublishDialog);
    }
  }

  function cancelBulkPublish() {
    if (bulkPublishDialog.submitting) {
      return;
    }
    setBulkPublishDialog(initialBulkPublishDialog);
  }

  async function updateBulkPublish(ids: string[], published: boolean, useFrozenIds = false) {
    if (bulkPublishAction) {
      return;
    }

    // 确认弹窗打开期间列表可能被 SWR 刷新：确认后必须提交弹窗中冻结的 ids，
    // 否则用户确认的篇数与实际请求的篇数会漂移（只缩不扩）。
    const targetRows = useFrozenIds ? [] : posts.filter((post) => ids.includes(post.id) && post.published !== published);
    const targetIds = useFrozenIds ? ids : targetRows.map((post) => post.id);

    if (targetIds.length === 0) {
      toast.info(published ? "所选文章已全部发布" : "所选文章已全部是草稿");
      return;
    }

    setBulkPublishAction(published ? "publish" : "draft");
    setBusyRowIds((prev) => Array.from(new Set([...prev, ...targetIds])));

    try {
      const data = await apiMutate<{ success: boolean; data?: { count?: number } }>("/api/admin/posts/publish", {
        method: "PATCH",
        body: JSON.stringify({ ids: targetIds, published }),
      });
      const count = data.data?.count ?? targetIds.length;
      toast.success(published ? `已发布 ${count} 篇文章` : `已将 ${count} 篇文章转为草稿`);
      void mutateList();
    } catch (error) {
      toast.error(toErrorMessage(error, published ? "批量发布失败" : "批量转草稿失败"));
      void mutateList();
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

  return {
    posts,
    pagination,
    stats,
    loading: isLoading || isValidating,
    query,
    setQuery,
    statusFilter,
    contentTypeFilter,
    page,
    pageSize,
    busyRowIds,
    bulkPublishAction,
    bulkAiIds,
    setBulkAiIds,
    visibleSelectedIds,
    currentPageIds,
    headerCheckboxState,
    hasSelection,
    activeSummaryIds,
    summaryReadyCount,
    deleteDialog,
    setDeleteDialog,
    publishDialog,
    bulkPublishDialog,
    mutateList,
    syncSummaryJobs,
    toggleAllCurrentPage,
    toggleOne,
    openDeleteDialog,
    confirmDelete,
    togglePublish,
    requestTogglePublish,
    confirmTogglePublish,
    cancelTogglePublish,
    updateBulkPublish,
    requestBulkPublish,
    confirmBulkPublish,
    cancelBulkPublish,
    handleStatusFilter,
    handleContentTypeFilter,
    setPage,
    setPageSize,
  };
}
