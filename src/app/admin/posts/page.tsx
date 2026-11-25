"use client";

/**
 * 后台文章列表页（页面壳）。
 *
 * 数据逻辑见 `components/admin/posts/hooks/usePostsList.ts`，
 * 表格渲染见 `components/admin/posts/PostsTable.tsx`，
 * 展示组件与纯函数见 `components/admin/posts/posts-ui.tsx`。
 */

import Link from "next/link";
import { Clock3, Eye, FileText, Loader2, PencilLine, Search, Send, Sparkles, WandSparkles } from "lucide-react";

import { DeleteImpactDialog } from "@/components/admin/DeleteImpactDialog";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { BulkAiCompletionDialog } from "@/components/admin/ai/BulkAiCompletionDialog";
import { Badge } from "@/components/coss/ui/badge";
import { Button } from "@/components/coss/ui/button";
import { Card, CardContent } from "@/components/coss/ui/card";
import { Input } from "@/components/coss/ui/input";
import { Separator } from "@/components/coss/ui/separator";
import { TooltipProvider } from "@/components/admin/ui/tooltip";

import { PostsTable } from "@/components/admin/posts/PostsTable";
import {
  formatNumber,
  FilterButton,
  MetricCard,
  StatusPill,
} from "@/components/admin/posts/posts-ui";
import {
  initialDeleteDialog,
  usePostsList,
} from "@/components/admin/posts/hooks/usePostsList";
import { apiMutate } from "@/lib/client-api";

export default function AdminPostsPage() {
  const postsList = usePostsList();

  const {
    posts,
    pagination,
    stats,
    loading,
    query,
    setQuery,
    statusFilter,
    contentTypeFilter,
    busyRowIds,
    bulkPublishAction,
    bulkAiIds,
    setBulkAiIds,
    visibleSelectedIds,
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
    requestTogglePublish,
    confirmTogglePublish,
    cancelTogglePublish,
    requestBulkPublish,
  updateBulkPublish,
    confirmBulkPublish,
    cancelBulkPublish,
    handleStatusFilter,
    handleContentTypeFilter,
    setPage,
    setPageSize,
  } = postsList;

  return (
    <>
      <TooltipProvider>
        <div className="flex h-full min-h-0 flex-col gap-2.5 overflow-hidden text-[var(--foreground)]">
          <section className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                <h1 className="font-display text-lg font-bold tracking-tight text-[var(--foreground)]">
                  AI 内容队列
                </h1>
                <p className="text-xs font-medium text-[var(--text-muted)]">
                  {formatNumber(pagination.total)} 篇内容
                </p>
                {activeSummaryIds.length > 0 ? (
                  <StatusPill tone="amber" icon={Clock3}>{activeSummaryIds.length} 篇处理中</StatusPill>
                ) : null}
                {bulkPublishAction ? (
                  <StatusPill tone="cyan" icon={Loader2}>{bulkPublishAction === "publish" ? "批量发布中" : "批量转草稿中"}</StatusPill>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
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
                <Button
                  className="ml-1 h-7.5 shrink-0 whitespace-nowrap rounded-lg !bg-[var(--btn-regular-bg)] px-3 text-xs font-semibold !text-[var(--btn-content)] hover:!bg-[var(--btn-regular-bg-hover)]"
                  render={<Link href="/admin/posts/new" />}
                  size="sm"
                  variant="ghost"
                >
                  <PencilLine className="size-3.5" />
                  新建文章
                </Button>
              </div>
            </div>
          </section>

          <Card className="shrink-0 rounded-xl border-[var(--border)] bg-[var(--surface)] py-0 shadow-[var(--shadow-card)]">
            <CardContent className="flex flex-col gap-2.5 px-3.5 py-2.5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
                <label className="relative min-w-[220px] flex-1 md:max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-faint)]" />
                  <Input
                    aria-label="搜索文章"
                    className="h-8 rounded-lg !border-[var(--border)] !bg-[var(--surface-alt)] pl-6 text-xs !text-[var(--foreground)] shadow-none [&_input]:h-full [&_input]:placeholder:!text-[var(--text-faint)]"
                    placeholder="搜索标题或 slug"
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>

                <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-[var(--surface-alt)] p-1">
                  <FilterButton active={statusFilter === "all"} onClick={() => handleStatusFilter("all")}>全部内容</FilterButton>
                  <FilterButton active={statusFilter === "draft"} onClick={() => handleStatusFilter("draft")}>仅看草稿</FilterButton>
                  <FilterButton active={statusFilter === "published"} onClick={() => handleStatusFilter("published")}>已发布</FilterButton>
                  <Separator orientation="vertical" className="mx-0.5 hidden h-4 md:block" />
                  <FilterButton active={contentTypeFilter === "non-ai-daily"} onClick={() => handleContentTypeFilter(contentTypeFilter === "non-ai-daily" ? "all" : "non-ai-daily")}>
                    非 AI 日报
                  </FilterButton>
                </div>
              </div>

              {hasSelection ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-1.5">
                  <Badge variant="outline" className="h-7 rounded-md border-[var(--border)] bg-[var(--surface)] px-2.5 text-[var(--text-body)]">
                    已选 {formatNumber(visibleSelectedIds.length)}
                  </Badge>
                  <Button
                    className="h-8 rounded-md !border-[color-mix(in_oklab,var(--brand)_22%,var(--border))] !bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] px-3 !text-[var(--brand)] hover:!bg-[color-mix(in_oklab,var(--brand)_16%,var(--surface))]"
                    disabled={bulkPublishAction !== null}
                    onClick={() => setBulkAiIds(visibleSelectedIds)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Sparkles className="size-4" />
                    AI 批量补全
                  </Button>
                  <Button
                    className="h-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]"
                    disabled={bulkPublishAction !== null}
                    onClick={() => requestBulkPublish(visibleSelectedIds, true)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    批量发布
                  </Button>
                  <Button
                    className="h-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]"
                    disabled={bulkPublishAction !== null}
                    onClick={() => void updateBulkPublish(visibleSelectedIds, false)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    批量转草稿
                  </Button>
                  <Button
                    className="h-8 rounded-md"
                    disabled={bulkPublishAction !== null}
                    onClick={() => void openDeleteDialog(visibleSelectedIds)}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    批量删除
                  </Button>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-xs text-[var(--text-muted)]">
                  勾选文章后显示批量操作
                </p>
              )}
            </CardContent>
          </Card>

          <PostsTable
            busyRowIds={busyRowIds}
            headerCheckboxState={headerCheckboxState}
            loading={loading}
            onOpenDelete={(ids) => void openDeleteDialog(ids)}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
            onToggleAll={toggleAllCurrentPage}
            onToggleOne={toggleOne}
            onRequestTogglePublish={(row) => requestTogglePublish(row)}
            pagination={pagination}
            posts={posts}
            visibleSelectedIds={visibleSelectedIds}
          />
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

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认发布"
        description="发布后立即对读者可见。"
        onConfirm={confirmTogglePublish}
        onOpenChange={(open) => {
          if (!open) cancelTogglePublish();
        }}
        open={publishDialog.open}
        submitting={publishDialog.submitting}
        title="确认发布文章"
      />

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认批量发布"
        description="发布后立即对读者可见。"
        impacts={
          <div className="space-y-2">
            <p>本次将发布 {formatNumber(bulkPublishDialog.count)} 篇文章，发布后立即对读者可见。</p>
            {bulkPublishDialog.count > 5 ? (
              <p className="font-medium text-[var(--warning-foreground)]">
                本次批量发布超过 5 篇，请再次确认后执行。
              </p>
            ) : null}
          </div>
        }
        onConfirm={confirmBulkPublish}
        onOpenChange={(open) => {
          if (!open) cancelBulkPublish();
        }}
        open={bulkPublishDialog.open}
        submitting={bulkPublishDialog.submitting}
        title="确认批量发布"
      />

      <BulkAiCompletionDialog
        open={bulkAiIds.length > 0}
        selectedIds={bulkAiIds}
        onClose={() => setBulkAiIds([])}
        onStarted={(taskId) => {
          void apiMutate(`/api/admin/ai/batch?resume=1&taskId=${encodeURIComponent(taskId)}`).catch(
            () => undefined,
          );
          void mutateList();
          void syncSummaryJobs();
        }}
      />
    </>
  );
}
