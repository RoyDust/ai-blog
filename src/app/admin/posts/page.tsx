"use client";

/**
 * 后台文章列表页（页面壳，方向 A 第 14 节列表模板）。
 *
 * 顺序：页头 → 指标条 → 区块标题 → 工具栏 → 表格 → 分页，都在同一张纸面里。
 * 数据逻辑见 `components/admin/posts/hooks/usePostsList.ts`，
 * 表格渲染见 `components/admin/posts/PostsTable.tsx`，
 * 展示组件与纯函数见 `components/admin/posts/posts-ui.tsx`。
 */

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { DeleteImpactDialog } from "@/components/admin/DeleteImpactDialog";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { BulkAiCompletionDialog } from "@/components/admin/ai/BulkAiCompletionDialog";
import { Button } from "@/components/admin/ui";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { Toolbar, ToolbarDivider } from "@/components/admin/primitives/Toolbar";
import { ListCheckboxToggle, ListSearchInput, ListTabs, MetricStrip, SelectionSwap } from "@/components/admin/lists";
import { TooltipProvider } from "@/components/shadcn/ui/tooltip";

import { PostsTable } from "@/components/admin/posts/PostsTable";
import { formatNumber } from "@/components/admin/posts/posts-ui";
import { initialDeleteDialog, usePostsList, type StatusFilter } from "@/components/admin/posts/hooks/usePostsList";
import { apiMutate } from "@/lib/client-api";

const statusTabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部内容" },
  { value: "draft", label: "仅看草稿" },
  { value: "published", label: "已发布" },
];

/**
 * 本页页头已有唯一的实心「新建文章」，顶栏那个描边按钮在本页隐藏（README 14 已采纳假设）。
 * 外壳不归本页管：用只在本页挂载的样式隐藏，离开本页即移除。
 */
const hideHeaderNewPostCss = '[data-testid="admin-layout-content"] > header a[href="/admin/posts/new"]{display:none !important}';

export default function AdminPostsPage() {
  const postsList = usePostsList();
  const reduceMotion = useReducedMotion();

  const {
    posts,
    pagination,
    stats,
    initialLoading,
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

  const metaMotion = reduceMotion
    ? {}
    : { initial: { opacity: 0, x: -4 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };

  const meta = (
    <>
      <span>{formatNumber(pagination.total)} 篇内容</span>
      <span className="ed-meta-sep">·</span>
      <span>当前页 {formatNumber(posts.length)} 篇</span>
      <AnimatePresence initial={false}>
        {activeSummaryIds.length > 0 ? (
          <motion.span key="summary-active" className="font-bold text-[var(--warning)]" {...metaMotion}>
            <span className="ed-meta-sep">·</span>
            {activeSummaryIds.length} 篇处理中
          </motion.span>
        ) : null}
        {bulkPublishAction ? (
          <motion.span key="bulk-publish" className="font-bold text-[var(--focus)]" role="status" {...metaMotion}>
            <span className="ed-meta-sep">·</span>
            {bulkPublishAction === "publish" ? "批量发布中" : "批量转草稿中"}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </>
  );

  return (
    <>
      <TooltipProvider>
        <div className="flex h-full min-h-0 flex-col overflow-hidden text-[var(--foreground)] max-lg:overflow-y-auto">
          <PageHeader
            action={
              <Button asChild>
                <Link href="/admin/posts/new">新建文章</Link>
              </Button>
            }
            className="shrink-0"
            eyebrow="AI 运维"
            meta={meta}
            title="AI 内容队列"
          />

          <MetricStrip
            ariaLabel="按状态筛选"
            className="mt-1 shrink-0"
            items={[
              { key: "all", label: "全部", value: formatNumber(stats.total), note: "总内容池", pressed: statusFilter === "all", onSelect: () => handleStatusFilter("all") },
              { key: "published", label: "已发布", value: formatNumber(stats.published), note: "线上可见", pressed: statusFilter === "published", onSelect: () => handleStatusFilter("published") },
              { key: "draft", label: "草稿", value: formatNumber(stats.drafts), note: "待校稿", pressed: statusFilter === "draft", onSelect: () => handleStatusFilter("draft") },
              { key: "views", label: "阅读", value: formatNumber(stats.views), note: "累计阅读" },
              {
                key: "ai-ready",
                label: "AI 就绪",
                value: `${formatNumber(summaryReadyCount)}/${formatNumber(posts.length)}`,
                note: "当前页摘要",
                tone: activeSummaryIds.length > 0 ? "warning" : "default",
              },
            ]}
          />

          <AdminSectionHeader
            aside={
              <span className="ed-mono">
                <span>
                  第 {formatNumber(pagination.page)} / {formatNumber(pagination.totalPages)} 页
                </span>
                <span className="ed-meta-sep">·</span>
                <span>{formatNumber(pagination.total)} 条记录</span>
              </span>
            }
            className="mt-6 shrink-0"
            description="发布状态、AI 摘要和数据上下文"
            title="文章列表"
          />

          <Toolbar
            className="shrink-0"
            leading={
              <>
                <ListSearchInput
                  ariaLabel="搜索文章"
                  onChange={(value) => {
                    setQuery(value);
                    setPage(1);
                  }}
                  placeholder="搜索标题或 slug"
                  value={query}
                />
                <ListTabs ariaLabel="发布状态" items={statusTabs} onChange={handleStatusFilter} value={statusFilter} />
                <ToolbarDivider />
                <ListCheckboxToggle
                  checked={contentTypeFilter === "non-ai-daily"}
                  label="非 AI 日报"
                  onChange={(checked) => handleContentTypeFilter(checked ? "non-ai-daily" : "all")}
                />
              </>
            }
            trailing={
              <SelectionSwap count={visibleSelectedIds.length} idle="勾选文章后显示批量操作">
                <Button disabled={bulkPublishAction !== null} onClick={() => setBulkAiIds(visibleSelectedIds)} size="sm" type="button" variant="outline">
                  AI 批量补全
                </Button>
                <Button
                  disabled={bulkPublishAction !== null}
                  onClick={() => requestBulkPublish(visibleSelectedIds, true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  批量发布
                </Button>
                <Button
                  disabled={bulkPublishAction !== null}
                  onClick={() => void updateBulkPublish(visibleSelectedIds, false)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  批量转草稿
                </Button>
                <Button
                  disabled={bulkPublishAction !== null}
                  onClick={() => void openDeleteDialog(visibleSelectedIds)}
                  size="sm"
                  type="button"
                  variant="outline-danger"
                >
                  批量删除
                </Button>
              </SelectionSwap>
            }
          />

          <PostsTable
            busyRowIds={busyRowIds}
            headerCheckboxState={headerCheckboxState}
            loading={initialLoading}
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

      <style>{hideHeaderNewPostCss}</style>

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
        description={`本次将发布 ${formatNumber(bulkPublishDialog.count)} 篇文章，发布后立即对读者可见。`}
        impacts={
          bulkPublishDialog.count > 5 ? (
            <p className="border-l-2 border-[var(--warning)] pl-3 font-bold text-[var(--warning)]">本次批量发布超过 5 篇，请再次确认后执行。</p>
          ) : undefined
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
          void apiMutate(`/api/admin/ai/batch?resume=1&taskId=${encodeURIComponent(taskId)}`).catch(() => undefined);
          void mutateList();
          void syncSummaryJobs();
        }}
      />
    </>
  );
}
