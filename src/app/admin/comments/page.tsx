"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import {
  ListTabs,
  ListSearchInput,
  LoadingStatus,
  MetricStrip,
  MotionTableRow,
  SelectionSwap,
  SkeletonTableRows,
  TableStateRow,
} from "@/components/admin/lists";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar, ToolbarDivider } from "@/components/admin/primitives/Toolbar";
import { Button } from "@/components/admin/ui";
import { EmptyState } from "@/components/editorial";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { getApiErrorMessage } from "@/lib/admin-api-client";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";
import { readPositiveInteger, useFilterMemory } from "@/hooks/useFilterMemory";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  status: CommentStatus;
  author: { name: string | null; email: string } | null;
  authorLabel?: string | null;
  post: { title: string; slug: string };
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

const statusMeta: Record<CommentStatus, { label: string; tone: "success" | "warning" | "danger" | "muted" }> = {
  APPROVED: { label: "已通过", tone: "success" },
  PENDING: { label: "待审核", tone: "warning" },
  REJECTED: { label: "已驳回", tone: "danger" },
  SPAM: { label: "已隐藏", tone: "muted" },
};

const defaultPageSize = 10;
const commentsFilterMemoryKey = "admin:comments:list-filters";
const commentStatusFilters = ["ALL", "APPROVED", "PENDING", "REJECTED", "SPAM"] as const;
const pageSizeOptions = [10, 20, 50, 100];

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CommentStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  spam: number;
};

const emptyStats: CommentStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  spam: 0,
};

type CommentStatusFilter = "ALL" | CommentStatus;
type CommentsFilterMemory = {
  query: string;
  statusFilter: CommentStatusFilter;
  page: number;
  pageSize: number;
};

const fallbackCommentsFilterMemory: CommentsFilterMemory = {
  query: "",
  statusFilter: "ALL",
  page: 1,
  pageSize: defaultPageSize,
};

function validateCommentsFilterMemory(parsed: Partial<CommentsFilterMemory>, fallback: CommentsFilterMemory): CommentsFilterMemory {
  const nextPageSize = readPositiveInteger(parsed.pageSize, fallback.pageSize);

  return {
    query: typeof parsed.query === "string" ? parsed.query : fallback.query,
    statusFilter: commentStatusFilters.includes(parsed.statusFilter as CommentStatusFilter) ? (parsed.statusFilter as CommentStatusFilter) : fallback.statusFilter,
    page: readPositiveInteger(parsed.page, fallback.page),
    pageSize: pageSizeOptions.includes(nextPageSize) ? nextPageSize : fallback.pageSize,
  };
}


const triageFilters: Array<{ value: CommentStatusFilter; label: string }> = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已驳回" },
  { value: "SPAM", label: "已隐藏" },
];

const commentColumnCount = 7;
const commentSkeletonBars = ["checkbox", "w-[70%]", "w-12", "w-24", "w-[66%]", "w-20", "w-24"];

/** 治理队列表体：骨架（保留表头）→ 加载失败（重试）→ 空列表 → 单行数据行 */
function CommentsTableBody({
  comments,
  showSkeleton,
  commentsError,
  visibleSelectedIds,
  pagination,
  onRetry,
  toggleOne,
  updateStatuses,
  openDeleteDialog,
}: {
  comments: CommentRow[];
  showSkeleton: boolean;
  commentsError: unknown;
  visibleSelectedIds: string[];
  pagination: PaginationState;
  onRetry: () => void;
  toggleOne: (id: string) => void;
  updateStatuses: (ids: string[], status: CommentStatus) => Promise<void>;
  openDeleteDialog: (ids: string[]) => Promise<void>;
}) {
  if (showSkeleton) {
    return <SkeletonTableRows bars={commentSkeletonBars} />;
  }

  if (commentsError) {
    return (
      <TableStateRow colSpan={commentColumnCount}>
        <EmptyState
          actions={
            <Button onClick={onRetry} size="sm" type="button" variant="outline">
              重试
            </Button>
          }
          role="alert"
          title="评论列表加载失败，请稍后重试"
          tone="danger"
        />
      </TableStateRow>
    );
  }

  if (comments.length === 0) {
    return (
      <TableStateRow colSpan={commentColumnCount}>
        <EmptyState description="当前筛选条件下没有评论。" role="status" title="暂无评论" />
      </TableStateRow>
    );
  }

  return comments.map((row, rowIndex) => {
    const isSelected = visibleSelectedIds.includes(row.id);
    const authorName = row.authorLabel || row.author?.name || row.author?.email || "匿名访客";
    const isAnonymous = !row.author;
    const meta = statusMeta[row.status];

    return (
      <MotionTableRow key={row.id} selected={isSelected}>
        <TableCell className="pr-0">
          <input
            aria-label={`选择第 ${(pagination.page - 1) * pagination.limit + rowIndex + 1} 行`}
            checked={isSelected}
            className="ed-checkbox align-middle"
            onChange={() => toggleOne(row.id)}
            type="checkbox"
          />
        </TableCell>
        <TableCell className="truncate text-[0.875rem] text-[var(--foreground)]" title={row.content}>
          {row.content}
        </TableCell>
        <TableCell className={isAnonymous ? "truncate text-[0.8125rem] text-[var(--text-muted)]" : "truncate text-[0.8125rem] font-bold text-[var(--foreground)]"}>
          {authorName}
        </TableCell>
        <TableCell>
          <span className="flex items-baseline gap-2">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            <span className="text-xs text-[var(--text-muted)]">{row.status === "PENDING" ? "待你决策" : "已处理"}</span>
          </span>
        </TableCell>
        <TableCell className="overflow-hidden">
          <Link
            className="block truncate text-[0.8125rem] text-[var(--text-body)] decoration-[var(--accent-sky)] decoration-1 underline-offset-4 transition-colors hover:text-[var(--foreground)] hover:underline"
            href={`/posts/${row.post.slug}`}
            title={row.post.title}
          >
            {row.post.title}
          </Link>
        </TableCell>
        <TableCell className="font-mono text-[0.8125rem] text-[var(--text-muted)] tabular-nums">{new Date(row.createdAt).toLocaleDateString("zh-CN")}</TableCell>
        <TableCell>
          <span className="flex items-center gap-3">
            <button className={adminTextActionClassName} onClick={() => void updateStatuses([row.id], "APPROVED")} type="button">
              通过
            </button>
            <button className={adminTextActionClassName} onClick={() => void updateStatuses([row.id], "REJECTED")} type="button">
              驳回
            </button>
            <button className={adminTextActionDangerClassName} onClick={() => void openDeleteDialog([row.id])} type="button">
              隐藏
            </button>
          </span>
        </TableCell>
      </MotionTableRow>
    );
  });
}

/**
 * 后台评论收件箱（方向 A 第 14 节列表模板）：页头 → 指标条 → 区块标题 → 工具栏 → 表格 → 分页。
 * 指标条与工具栏 tab 共用 statusFilter；批量操作勾选后才出现，替换工具栏右侧的聚焦说明。
 */
export default function AdminCommentsPage() {
  const { initialMemory, persist } = useFilterMemory<CommentsFilterMemory>(commentsFilterMemoryKey, fallbackCommentsFilterMemory, validateCommentsFilterMemory);
  const [query, setQuery] = useState(initialMemory.query);
  const [debouncedQuery, setDebouncedQuery] = useState(initialMemory.query);
  const [statusFilter, setStatusFilter] = useState<CommentStatusFilter>(initialMemory.statusFilter);
  const [page, setPage] = useState(initialMemory.page);
  const [pageSize, setPageSize] = useState(initialMemory.pageSize);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // 300ms 防抖：setState 只发生在事件回调与定时器回调中（不在 effect 体内）
  const debounceTimerRef = useRef<number | null>(null);
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedQuery(value);
    }, 300);
  };

  // 卸载时清理未触发的防抖定时器（纯清理，无 setState）
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const buildCommentsUrl = (pageNumber: number) => {
    const params = new URLSearchParams({
      page: String(pageNumber),
      limit: String(pageSize),
    });
    const keyword = debouncedQuery.trim();
    if (keyword) params.set("q", keyword);
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    return `/api/admin/comments?${params.toString()}`;
  };

  const {
    data: commentsResponse,
    error: commentsError,
    isLoading,
    isValidating,
    mutate: mutateComments,
  } = useSWR<{ success?: boolean; data?: CommentRow[]; pagination?: PaginationState; stats?: CommentStats }>(
    buildCommentsUrl(page),
    apiFetcher,
    {
      keepPreviousData: true,
      revalidateOnMount: true,
      onError: (swrError, key) => {
        handleGlobalSwrError(swrError, key);
        toast.error(toErrorMessage(swrError, "评论列表加载失败，请稍后重试"));
      },
    },
  );

  const comments = useMemo(() => commentsResponse?.data ?? [], [commentsResponse?.data]);
  const pagination = commentsResponse?.pagination ?? {
    page,
    limit: pageSize,
    total: comments.length,
    totalPages: Math.max(1, Math.ceil(comments.length / pageSize)),
  };
  const stats = commentsResponse?.stats ?? emptyStats;
  // 骨架只在当前 key 尚无数据时出现（首次加载 / 切换筛选）；操作后的静默刷新不打断已有行
  const showSkeleton = isLoading;

  // 服务端校正页码时同步回状态（渲染期条件调整，仅在真实响应到达后；
  // keepPreviousData 下旧响应会先于新响应出现，isValidating 期间不校正，避免翻页被旧页码拉回）
  if (commentsResponse?.pagination && !isValidating && commentsResponse.pagination.page !== page) {
    setPage(commentsResponse.pagination.page);
  }

  // 筛选记忆持久化（纯副作用，无 setState）
  useEffect(() => {
    persist({
      query,
      statusFilter,
      page,
      pageSize,
    });
  }, [page, pageSize, persist, query, statusFilter]);

  // 勾选：只认当前页仍在的行；表头勾选框支持半选
  const currentPageIds = useMemo(() => comments.map((row) => row.id), [comments]);
  const visibleSelectedIds = useMemo(() => selectedIds.filter((id) => currentPageIds.includes(id)), [currentPageIds, selectedIds]);
  const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => visibleSelectedIds.includes(id));
  const partiallySelected = !allCurrentPageSelected && visibleSelectedIds.length > 0;

  const toggleAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const applyStatusFilter = (nextFilter: CommentStatusFilter) => {
    setStatusFilter(nextFilter);
    setPage(1);
  };

  async function updateStatuses(ids: string[], status: CommentStatus) {
    try {
      await apiMutate("/api/admin/comments", {
        method: "PATCH",
        body: JSON.stringify({ ids, status }),
      });
      toast.success(ids.length > 1 ? `已更新 ${ids.length} 条评论状态` : "评论状态已更新");
      void mutateComments();
    } catch (error) {
      toast.error(toErrorMessage(error, "评论状态更新失败，请稍后重试"));
    }
  }

  async function openDeleteDialog(ids: string[]) {
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const data = await apiMutate<{ success: boolean; data?: DeleteDialogState }>(`/api/admin/comments?${params.toString()}`);

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
      await apiMutate(`/api/admin/comments?${params.toString()}`, { method: "DELETE" });

      setDeleteDialog(initialDeleteDialog);
      toast.success(deleteDialog.ids.length > 1 ? `已隐藏 ${deleteDialog.ids.length} 条评论` : "评论已隐藏");
      void mutateComments();
    } catch (error) {
      toast.error(toErrorMessage(error, "隐藏评论失败，请稍后重试"));
      setDeleteDialog((prev) => ({ ...prev, submitting: false }));
    }
  }

  const focusLabel = statusFilter === "ALL" ? "全部评论" : `${statusMeta[statusFilter].label} 评论`;

  return (
    <>
      <div>
        <PageHeader
          description="围绕待审核、已通过与已驳回组织评论治理，优先完成 triage 操作。"
          eyebrow="评论审核"
          title="评论收件箱"
        />

        <MetricStrip
          ariaLabel="按状态筛选"
          className="mt-1"
          items={[
            { key: "ALL", label: "全部评论", value: stats.total.toLocaleString("zh-CN"), note: "点击快速过滤全部评论", pressed: statusFilter === "ALL", onSelect: () => applyStatusFilter("ALL") },
            {
              key: "PENDING",
              label: "待审核",
              value: stats.pending.toLocaleString("zh-CN"),
              note: "新评论进入待处理，优先审核",
              tone: stats.pending > 0 ? "warning" : "default",
              pressed: statusFilter === "PENDING",
              onSelect: () => applyStatusFilter("PENDING"),
            },
            { key: "APPROVED", label: "已通过", value: stats.approved.toLocaleString("zh-CN"), note: "确认优质互动继续在线展示", pressed: statusFilter === "APPROVED", onSelect: () => applyStatusFilter("APPROVED") },
            { key: "REJECTED", label: "已驳回", value: stats.rejected.toLocaleString("zh-CN"), note: "被驳回或标记为不通过的评论", pressed: statusFilter === "REJECTED", onSelect: () => applyStatusFilter("REJECTED") },
          ]}
        />

        <section aria-labelledby="admin-comments-queue-title" className="mt-6">
          <AdminSectionHeader
            aside={
              <span className="ed-mono">
                <span>
                  第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页
                </span>
                <span className="ed-meta-sep">·</span>
                <span>{pagination.total} 条记录</span>
              </span>
            }
            description="在一个视图里完成审核、驳回与隐藏操作。"
            id="admin-comments-queue-title"
            title="治理队列"
          />

          <Toolbar
            leading={
              <>
                <div className="min-w-[12rem] flex-1">
                  <label className="sr-only" htmlFor="admin-comments-search">
                    搜索评论
                  </label>
                  <ListSearchInput
                    className="sm:w-full"
                    id="admin-comments-search"
                    onChange={handleQueryChange}
                    placeholder="搜索评论内容或文章标题"
                    value={query}
                  />
                </div>
                <ListTabs ariaLabel="评论状态" items={triageFilters} onChange={applyStatusFilter} value={statusFilter} />
                <ToolbarDivider />
              </>
            }
            trailing={
              <SelectionSwap
                count={visibleSelectedIds.length}
                idle={
                  <>
                    当前聚焦 <span className="font-bold text-[var(--foreground)]">{focusLabel}</span>
                  </>
                }
              >
                <Button onClick={() => void updateStatuses(visibleSelectedIds, "APPROVED")} size="sm" type="button" variant="outline">
                  批量通过
                </Button>
                <Button onClick={() => void updateStatuses(visibleSelectedIds, "PENDING")} size="sm" type="button" variant="outline">
                  批量设为待审核
                </Button>
                <Button onClick={() => void updateStatuses(visibleSelectedIds, "REJECTED")} size="sm" type="button" variant="outline-danger">
                  批量驳回
                </Button>
                <Button onClick={() => void openDeleteDialog(visibleSelectedIds)} size="sm" type="button" variant="outline-danger">
                  批量隐藏
                </Button>
              </SelectionSwap>
            }
          />

          <div aria-busy={showSkeleton || undefined} className="overflow-x-auto">
            {showSkeleton ? <LoadingStatus label="正在加载评论队列..." /> : null}
            <table className="w-full min-w-[860px] table-fixed caption-bottom text-sm xl:min-w-[1080px]" data-slot="table">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pr-0">
                    <input
                      aria-checked={partiallySelected ? "mixed" : allCurrentPageSelected}
                      aria-label="选择当前页"
                      checked={allCurrentPageSelected}
                      className="ed-checkbox align-middle disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={showSkeleton || comments.length === 0}
                      onChange={toggleAll}
                      ref={(element) => {
                        if (element) element.indeterminate = partiallySelected;
                      }}
                      type="checkbox"
                    />
                  </TableHead>
                  <TableHead>评论内容</TableHead>
                  <TableHead className="w-[104px]">作者</TableHead>
                  <TableHead className="w-[136px]">状态</TableHead>
                  <TableHead className="w-[22%]">所属文章</TableHead>
                  <TableHead className="w-[104px]">日期</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <CommentsTableBody
                  comments={comments}
                  commentsError={commentsError}
                  onRetry={() => void mutateComments()}
                  openDeleteDialog={openDeleteDialog}
                  pagination={pagination}
                  showSkeleton={showSkeleton}
                  toggleOne={toggleOne}
                  updateStatuses={updateStatuses}
                  visibleSelectedIds={visibleSelectedIds}
                />
              </TableBody>
            </table>
          </div>

          {!showSkeleton && !commentsError && comments.length > 0 ? (
            <AdminPagination
              itemLabel="条记录"
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              page={pagination.page}
              pageSize={pagination.limit}
              pageSizeOptions={pageSizeOptions}
              total={pagination.total}
              totalPages={Math.max(pagination.totalPages, 1)}
            />
          ) : null}
        </section>
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog((prev) => (open ? prev : initialDeleteDialog))}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}
