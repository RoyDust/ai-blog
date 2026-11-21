"use client";

/**
 * 后台文章列表表格（含分页栏）。
 * 纯展示组件：数据与操作回调由页面壳传入。
 */

import Link from "next/link";
import { Eye, FileText, Heart, MessageSquare, PencilLine, Trash2 } from "lucide-react";

import { Button } from "@/components/shadcn/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import { Checkbox } from "@/components/shadcn/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/ui/empty";
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
import { cn } from "@/lib/utils";

import { AdminPagination } from "@/components/admin/primitives/AdminPagination";

import { getSummaryStatus, type PaginationState, type PostRow } from "./hooks/usePostsList";
import {
  fallbackText,
  formatDate,
  formatNumber,
  getPreviewHref,
  getSummaryMeta,
  IconAction,
  placeholder,
  PublishToggleTag,
  StatusPill,
} from "./posts-ui";

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
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border-[var(--border)] bg-[var(--surface)] py-0 shadow-none">
      <CardHeader className="shrink-0 gap-0 border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-[var(--foreground)]">文章列表</CardTitle>
            <p className="mt-1 text-xs text-[var(--text-muted)]">发布状态、AI 摘要和数据上下文</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-mono tabular-nums">第 {formatNumber(pagination.page)} / {formatNumber(pagination.totalPages)} 页</span>
            <Separator orientation="vertical" className="hidden h-4 md:block" />
            <span>{formatNumber(posts.length)} 条记录</span>
          </div>
        </div>
      </CardHeader>

      <div className="min-h-0 flex-1 overflow-auto" data-testid="admin-data-table-scroll">
        <Table className="min-w-[860px] table-fixed xl:min-w-[1160px] 2xl:min-w-[1220px]">
          <TableHeader className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-alt)] shadow-[0_1px_0_rgba(15,23,42,0.06)]">
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead className="w-12 px-4">
                <Checkbox
                  aria-label="选择当前页"
                  className="!border-[var(--border-strong)] !bg-[var(--surface)] data-[state=checked]:!border-[var(--brand)] data-[state=checked]:!bg-[var(--brand)] data-[state=indeterminate]:!border-[var(--brand)] data-[state=indeterminate]:!bg-[var(--brand)]"
                  checked={headerCheckboxState}
                  disabled={loading || posts.length === 0}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                />
              </TableHead>
              <TableHead className="w-[34%] text-xs font-semibold text-[var(--text-muted)] xl:w-[30%]">标题</TableHead>
              <TableHead className="hidden w-[13%] text-xs font-semibold text-[var(--text-muted)] xl:table-cell">作者</TableHead>
              <TableHead className="w-[32%] text-xs font-semibold text-[var(--text-muted)] xl:w-[24%]">AI 摘要</TableHead>
              <TableHead className="w-[148px] text-xs font-semibold text-[var(--text-muted)]">发布</TableHead>
              <TableHead className="hidden w-[13%] pl-6 text-xs font-semibold text-[var(--text-muted)] 2xl:table-cell">上下文</TableHead>
              <TableHead className="hidden w-[10%] text-xs font-semibold text-[var(--text-muted)] xl:table-cell">日期</TableHead>
              <TableHead className="w-[104px] text-right text-xs font-semibold text-[var(--text-muted)]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }, (_, index) => (
                <TableRow key={index} className="border-[var(--border)]">
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
                      "border-[var(--border)] transition-colors hover:bg-[var(--surface-alt)]/80",
                      isSelected && "bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface))] hover:bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))]",
                    )}
                  >
                    <TableCell className="px-4 align-top">
                      <Checkbox
                        aria-label={`选择 ${row.id}`}
                        className="!border-[var(--border-strong)] !bg-[var(--surface)] data-[state=checked]:!border-[var(--brand)] data-[state=checked]:!bg-[var(--brand)]"
                        checked={isSelected}
                        onCheckedChange={(checked) => onToggleOne(row.id, checked === true)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <div className="min-w-0 space-y-1">
                        <Link className="line-clamp-1 font-medium text-[var(--foreground)] hover:text-[var(--brand)]" href={`/admin/posts/${row.id}/edit`}>
                          {titleText}
                        </Link>
                        <p className="line-clamp-1 font-mono text-xs text-[var(--text-muted)]">{slugText}</p>
                        <p className="line-clamp-1 text-xs text-[var(--text-muted)] xl:hidden">
                          {authorName} / {formatDate(row.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal align-top xl:table-cell">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">{authorName}</p>
                        {authorEmail && authorEmail !== authorName ? (
                          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{authorEmail}</p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <div className="max-w-[300px] space-y-1.5">
                        <StatusPill tone={summaryMeta.tone} icon={summaryMeta.icon}>{summaryMeta.label}</StatusPill>
                        <p className={cn("line-clamp-2 text-xs leading-5 text-[var(--text-muted)]", summaryStatus === "FAILED" && "text-[var(--danger-foreground)]")}>
                          {summaryText}
                        </p>
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[var(--text-muted)] 2xl:hidden">
                          <span>阅读 {formatNumber(row.viewCount)}</span>
                          <span>评论 {formatNumber(row._count?.comments)}</span>
                          <span>点赞 {formatNumber(row._count?.likes)}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <PublishToggleTag
                        busy={busyRowIds.includes(row.id)}
                        onRequestTogglePublish={() => onRequestTogglePublish(row)}
                        published={row.published}
                      />
                    </TableCell>
                    <TableCell className="hidden whitespace-normal pl-6 align-top 2xl:table-cell">
                      <div className="grid gap-1 text-xs text-[var(--text-muted)]">
                        <span className="flex items-center gap-1.5"><Eye className="size-3.5" />阅读 {formatNumber(row.viewCount)}</span>
                        <span className="flex items-center gap-1.5"><MessageSquare className="size-3.5" />评论 {formatNumber(row._count?.comments)}</span>
                        <span className="flex items-center gap-1.5"><Heart className="size-3.5" />点赞 {formatNumber(row._count?.likes)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden align-top font-mono text-xs tabular-nums text-[var(--text-muted)] xl:table-cell">
                      {formatDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-1">
                        <IconAction label="编辑">
                          <Button asChild aria-label="编辑" className="size-8 rounded-md !text-[var(--text-body)] hover:!bg-[var(--surface-alt)] hover:!text-[var(--brand)]" size="icon-sm" variant="ghost">
                            <Link href={`/admin/posts/${row.id}/edit`}>
                              <PencilLine className="size-4" />
                            </Link>
                          </Button>
                        </IconAction>
                        {previewHref ? (
                          <IconAction label="预览">
                            <Button asChild aria-label="预览" className="size-8 rounded-md !text-[var(--text-body)] hover:!bg-[var(--surface-alt)] hover:!text-[var(--brand)]" size="icon-sm" variant="ghost">
                              <Link href={previewHref}>
                                <Eye className="size-4" />
                              </Link>
                            </Button>
                          </IconAction>
                        ) : (
                          <IconAction label="缺少 slug">
                            <Button aria-label="预览" className="size-8 rounded-md !text-[var(--text-faint)]" disabled size="icon-sm" type="button" variant="ghost">
                              <Eye className="size-4" />
                            </Button>
                          </IconAction>
                        )}
                        <IconAction label="删除">
                          <Button
                            aria-label="删除"
                            className="size-8 rounded-md !text-[var(--danger-foreground)] hover:!bg-[var(--danger-surface)] hover:!text-[var(--danger-foreground)]"
                            onClick={() => onOpenDelete([row.id])}
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
        <AdminPagination
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
    </Card>
  );
}
