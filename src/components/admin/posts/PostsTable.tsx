"use client";

/**
 * 后台文章列表表格（含分页栏，方向 A 第 14 / 17.3 节）。
 * 纯展示组件：数据与操作回调由页面壳传入。
 *
 * - 每格单行截断，行高 44px；slug 不再独占一行，悬停标题时以 title 提示
 * - 作者只显示名字；AI 摘要是语气色状态 + 同一行截断预览，失败时换成错误原因
 * - 「上下文」列（阅读 / 评论 / 点赞）只在 2xl 出现
 */

import Link from "next/link";

import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { EmptyState } from "@/components/editorial";
import { LoadingStatus, MotionTableRow, SkeletonTableRows, TableStateRow } from "@/components/admin/lists";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { cn } from "@/lib/utils";

import { getSummaryStatus, type PaginationState, type PostRow } from "./hooks/usePostsList";
import { fallbackText, formatDate, formatNumber, PostRowActions, PublishToggleTag, SummaryCell } from "./posts-ui";

const columnCount = 8;
const skeletonBars = ["checkbox", "w-[62%]", "w-10", "w-[72%]", "w-20", "w-24", "w-[72px]", "w-24"];

export function PostsTable({
  posts,
  loading,
  pagination,
  busyRowIds,
  visibleSelectedIds,
  headerCheckboxState,
  onToggleAll,
  onToggleOne,
  onRequestTogglePublish,
  onOpenDelete,
  onPageChange,
  onPageSizeChange,
}: {
  posts: PostRow[];
  /** 首次加载 / 切换筛选时显示骨架（保留表头） */
  loading: boolean;
  pagination: PaginationState;
  busyRowIds: string[];
  visibleSelectedIds: string[];
  headerCheckboxState: boolean | "indeterminate";
  onToggleAll: (checked: boolean) => void;
  onToggleOne: (id: string, checked: boolean) => void;
  onRequestTogglePublish: (row: PostRow) => void;
  onOpenDelete: (ids: string[]) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const showSkeleton = loading;

  return (
    <div className="flex min-h-0 flex-1 flex-col max-lg:flex-none">
      {/* 桌面：固定高度纸面内滚动、表头吸顶；手机：整页滚动，表格只横向滚动 */}
      <div className="min-h-0 flex-1 overflow-auto max-lg:flex-none" data-testid="admin-data-table-scroll" aria-busy={showSkeleton || undefined}>
        {showSkeleton ? <LoadingStatus label="正在加载文章" /> : null}
        <table className="w-full min-w-[860px] table-fixed caption-bottom text-sm xl:min-w-[1080px]" data-slot="table">
          <TableHeader className="sticky top-0 z-10 bg-[var(--card-bg)]">
            <TableRow>
              <TableHead className="w-10 pr-0">
                <input
                  aria-checked={headerCheckboxState === "indeterminate" ? "mixed" : headerCheckboxState}
                  aria-label="选择当前页"
                  checked={headerCheckboxState === true}
                  className="ed-checkbox align-middle disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={showSkeleton || posts.length === 0}
                  onChange={() => onToggleAll(headerCheckboxState !== true)}
                  ref={(element) => {
                    if (element) element.indeterminate = headerCheckboxState === "indeterminate";
                  }}
                  type="checkbox"
                />
              </TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="hidden w-[88px] xl:table-cell">作者</TableHead>
              <TableHead className="w-[32%] xl:w-[24%]">AI 摘要</TableHead>
              <TableHead className="w-[124px]">发布</TableHead>
              <TableHead className="hidden w-[200px] 2xl:table-cell">上下文</TableHead>
              <TableHead className="hidden w-[104px] xl:table-cell">日期</TableHead>
              <TableHead className="w-[124px] text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <SkeletonTableRows bars={skeletonBars} />
            ) : posts.length === 0 ? (
              <TableStateRow colSpan={columnCount}>
                <EmptyState description="当前筛选条件下没有内容。" role="status" title="暂无文章" />
              </TableStateRow>
            ) : (
              posts.map((row) => {
                const summaryStatus = getSummaryStatus(row);
                const isSelected = visibleSelectedIds.includes(row.id);
                const authorName = fallbackText(row.author?.name || row.author?.email);
                const titleText = fallbackText(row.title);
                const slugHint = row.slug?.trim() ? `/posts/${row.slug.trim()}` : "未设置 slug";
                const summaryText =
                  summaryStatus === "FAILED" ? fallbackText(row.summaryError || row.excerpt) : row.excerpt?.trim() || "还没有摘要。";

                return (
                  <MotionTableRow key={row.id} selected={isSelected}>
                    <TableCell className="pr-0">
                      <input
                        aria-label={`选择 ${row.id}`}
                        checked={isSelected}
                        className="ed-checkbox align-middle"
                        onChange={(event) => onToggleOne(row.id, event.target.checked)}
                        type="checkbox"
                      />
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <Link
                        className="block truncate font-serif text-[0.9375rem] leading-[1.45] font-bold text-[var(--foreground)] decoration-[var(--accent-sky)] decoration-1 underline-offset-4 hover:underline"
                        href={`/admin/posts/${row.id}/edit`}
                        title={slugHint}
                      >
                        {titleText}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden truncate text-[0.8125rem] font-bold text-[var(--foreground)] xl:table-cell" title={row.author?.email ?? undefined}>
                      {authorName}
                    </TableCell>
                    <TableCell className="overflow-hidden">
                      <SummaryCell status={summaryStatus} text={summaryText} />
                    </TableCell>
                    <TableCell>
                      <PublishToggleTag
                        busy={busyRowIds.includes(row.id)}
                        onRequestTogglePublish={() => onRequestTogglePublish(row)}
                        published={row.published}
                      />
                    </TableCell>
                    <TableCell className="hidden overflow-hidden text-xs text-[var(--text-muted)] 2xl:table-cell">
                      <span className="flex gap-3 font-mono tabular-nums">
                        <span>阅读 {formatNumber(row.viewCount)}</span>
                        <span>评论 {formatNumber(row._count?.comments)}</span>
                        <span>点赞 {formatNumber(row._count?.likes)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden font-mono text-[0.8125rem] text-[var(--text-muted)] tabular-nums xl:table-cell">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className={cn("text-right")}>
                      <PostRowActions onDelete={() => onOpenDelete([row.id])} row={row} />
                    </TableCell>
                  </MotionTableRow>
                );
              })
            )}
          </TableBody>
        </table>
      </div>

      {!showSkeleton && posts.length > 0 ? (
        <AdminPagination
          className="shrink-0"
          disabled={loading}
          itemLabel="条记录"
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          page={pagination.page}
          pageSize={pagination.limit}
          total={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </div>
  );
}
