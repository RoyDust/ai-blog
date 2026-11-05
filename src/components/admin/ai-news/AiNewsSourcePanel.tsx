"use client"

import { Search } from "lucide-react"
import { useState } from "react"

import { AdminPagination } from "@/components/admin/primitives/AdminPagination"
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader"
import { Toolbar, ToolbarDivider } from "@/components/admin/primitives/Toolbar"
import { adminTabClassName, adminTextActionClassName } from "@/components/admin/primitives/admin-classes"
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui"
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog"
import { FadeBanner } from "@/components/admin/workspace/WorkspaceKit"
import { ActiveUnderline, SkeletonBar } from "@/components/editorial"

import { AiNewsSourceFormDialog } from "./AiNewsSourceFormDialog"
import { AiNewsSourceRow, aiNewsSourceColumns } from "./AiNewsSourceRow"
import type { AiNewsSourceFormState, AiNewsSourcePagination, AiNewsSourceSummary, AiNewsSourceTestResult, PublicAiNewsSource } from "./types"

type AiNewsSourcePanelProps = {
  sources: PublicAiNewsSource[]
  selectedSourceIds: string[]
  sourceMode: "default" | "selected"
  query: string
  category: string
  pagination: AiNewsSourcePagination
  summary: AiNewsSourceSummary
  loading: boolean
  saving: boolean
  testingId: string | null
  deletingId: string | null
  message: string
  error: string
  testResults: Record<string, AiNewsSourceTestResult>
  onSourceModeChange: (mode: "default" | "selected") => void
  onQueryChange: (query: string) => void
  onCategoryChange: (category: string) => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onToggleSourceSelection: (sourceId: string) => void
  onSelectEnabledSources: () => void
  onReload: () => void
  onSaveSource: (form: AiNewsSourceFormState) => Promise<void>
  onToggleSourceEnabled: (source: PublicAiNewsSource) => void
  /** 站内确认弹窗确认后才调用（原生 confirm 已移除） */
  onDeleteSource: (source: PublicAiNewsSource) => Promise<void> | void
  onTestSource: (source: PublicAiNewsSource) => void
  /** 站内确认弹窗确认后才调用（原生 confirm 已移除） */
  onDisableProblemSources: () => Promise<void> | void
}

const groupFilters = [
  { id: "all", label: "全部" },
  { id: "official", label: "官方" },
  { id: "industry", label: "媒体" },
  { id: "developer", label: "开发者" },
  { id: "community", label: "社区" },
  { id: "github-release", label: "GitHub" },
]

const sourceModes = [
  { id: "default", label: "默认来源" },
  { id: "selected", label: "选中来源" },
] as const

const toolbarTextButtonClassName =
  "inline-flex h-8 cursor-pointer items-center px-1 text-[0.8125rem] font-bold whitespace-nowrap text-[var(--text-body)] transition-colors duration-150 hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-[var(--text-body)]"

const tableHeads = ["", "来源", "类型 · 分类", "状态", "权重", "抓取 · 候选 · 入选", "操作"]

/**
 * 「来源控制台」（方向 A 第 15 节）：区块标题右侧「刷新」文字按钮 + 「新增来源」描边按钮；
 * 模式、批量、分类筛选、搜索放进一行工具栏；来源是 44px 单行表格，测试结果在行下展开。
 * 删除来源、停用异常源走站内确认弹窗（文案沿用现状）。
 */
export function AiNewsSourcePanel({
  sources,
  selectedSourceIds,
  sourceMode,
  query,
  category,
  pagination,
  summary,
  loading,
  saving,
  testingId,
  deletingId,
  message,
  error,
  testResults,
  onSourceModeChange,
  onQueryChange,
  onCategoryChange,
  onPageChange,
  onPageSizeChange,
  onToggleSourceSelection,
  onSelectEnabledSources,
  onReload,
  onSaveSource,
  onToggleSourceEnabled,
  onDeleteSource,
  onTestSource,
  onDisableProblemSources,
}: AiNewsSourcePanelProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<PublicAiNewsSource | null>(null)
  const [formKey, setFormKey] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<PublicAiNewsSource | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [disableConfirmOpen, setDisableConfirmOpen] = useState(false)

  const selectedCount = selectedSourceIds.length
  const enabledCount = summary.enabledCount
  const problemCount = sources.filter((source) => source.enabled && source.healthWarnings.length > 0).length
  const showSkeleton = loading && sources.length === 0
  const showLoadFailed = !loading && sources.length === 0 && Boolean(error)
  const showEmpty = !loading && sources.length === 0 && !error

  const openCreate = () => {
    setEditingSource(null)
    setFormKey((current) => current + 1)
    setFormOpen(true)
  }

  const openEdit = (source: PublicAiNewsSource) => {
    setEditingSource(source)
    setFormKey((current) => current + 1)
    setFormOpen(true)
  }

  const requestDelete = (source: PublicAiNewsSource) => {
    if (!source.deletable) return
    setPendingDelete(source)
    setDeleteConfirmOpen(true)
  }

  return (
    <section aria-labelledby="ai-news-sources-title" data-slot="ai-news-sources">
      <AdminSectionHeader
        id="ai-news-sources-title"
        title="来源控制台"
        description={`默认启用 ${enabledCount} 个来源；当前选择 ${selectedCount} 个来源；匹配 ${pagination.total} 个来源。`}
        aside={
          <>
            <button type="button" className={adminTextActionClassName} onClick={onReload} disabled={loading}>
              刷新
            </button>
            <Button type="button" size="sm" variant="outline" onClick={openCreate}>
              新增来源
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-2 pt-3 empty:hidden">
        <FadeBanner message={message} tone="success" />
        <FadeBanner message={sources.length > 0 ? error : ""} tone="danger" />
      </div>

      <SourceToolbar
        sourceMode={sourceMode}
        category={category}
        query={query}
        disableProblemsDisabled={problemCount === 0 || saving}
        onSourceModeChange={onSourceModeChange}
        onSelectEnabledSources={onSelectEnabledSources}
        onRequestDisableProblems={() => setDisableConfirmOpen(true)}
        onCategoryChange={onCategoryChange}
        onQueryChange={onQueryChange}
      />

      <Table className="table-fixed" aria-busy={loading || undefined}>
        <colgroup>
          {aiNewsSourceColumns.map((width, index) => (
            <col key={index} className={width || undefined} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {tableHeads.map((head, index) => (
              <TableHead key={head || index} className={index === 4 ? "text-right" : undefined}>
                {head || <span className="ed-visually-hidden">选择</span>}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton
            ? Array.from({ length: 4 }, (_, index) => (
                <TableRow key={`skeleton-${index}`} aria-hidden="true">
                  <TableCell><SkeletonBar className="size-4" /></TableCell>
                  <TableCell><SkeletonBar className="h-3.5 w-[70%]" /></TableCell>
                  <TableCell><SkeletonBar className="h-3 w-20" /></TableCell>
                  <TableCell><SkeletonBar className="h-3 w-24" /></TableCell>
                  <TableCell><SkeletonBar className="ml-auto h-3 w-8" /></TableCell>
                  <TableCell><SkeletonBar className="h-3 w-32" /></TableCell>
                  <TableCell><SkeletonBar className="h-3 w-36" /></TableCell>
                </TableRow>
              ))
            : null}
          {showEmpty || showLoadFailed ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={tableHeads.length} className="h-auto py-6 whitespace-normal">
                {showLoadFailed ? (
                  <div role="alert" className="flex flex-col items-start gap-3">
                    <p className="ed-empty__title ed-empty__title--danger">来源加载失败</p>
                    <p className="text-[0.8125rem] text-[var(--text-muted)]">{error}</p>
                    <Button type="button" size="sm" variant="outline" onClick={onReload}>
                      重试
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-1">
                    <p className="ed-empty__title">没有匹配的来源。</p>
                    <p className="text-[0.8125rem] text-[var(--text-muted)]">换个分类或清空搜索后再看。</p>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ) : null}
          {sources.map((source) => (
            <AiNewsSourceRow
              key={source.id}
              source={source}
              selected={selectedSourceIds.includes(source.id)}
              sourceMode={sourceMode}
              testing={testingId === source.id}
              deleting={deletingId === source.id}
              testResult={testResults[source.id]}
              onToggleSelected={() => onToggleSourceSelection(source.id)}
              onToggleEnabled={() => onToggleSourceEnabled(source)}
              onEdit={() => openEdit(source)}
              onDelete={() => requestDelete(source)}
              onTest={() => onTestSource(source)}
            />
          ))}
        </TableBody>
      </Table>

      {pagination.total > 0 ? (
        <AdminPagination
          className="mt-1"
          disabled={loading}
          itemLabel="个来源"
          page={pagination.page}
          pageSize={pagination.limit}
          pageSizeOptions={[10, 20, 50]}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}

      <AiNewsSourceFormDialog
        key={formKey}
        open={formOpen}
        source={editingSource}
        saving={saving}
        onOpenChange={setFormOpen}
        onSubmit={onSaveSource}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        tone="danger"
        title="删除来源"
        description={pendingDelete ? `删除来源「${pendingDelete.name}」？历史候选会保留来源名称快照。` : ""}
        confirmLabel="确认删除"
        submitting={Boolean(pendingDelete && deletingId === pendingDelete.id)}
        onConfirm={async () => {
          if (!pendingDelete) return
          await onDeleteSource(pendingDelete)
          setDeleteConfirmOpen(false)
        }}
      />

      <ConfirmDialog
        open={disableConfirmOpen}
        onOpenChange={setDisableConfirmOpen}
        title="停用异常源"
        description={`停用 ${problemCount} 个有健康提醒的来源？`}
        confirmLabel="确认停用"
        submitting={saving}
        onConfirm={async () => {
          await onDisableProblemSources()
          setDisableConfirmOpen(false)
        }}
      />
    </section>
  )
}

/** 来源工具栏：模式页签 | 批量文字按钮 | 分类页签（2px sky 下划线平移），右侧 36px 搜索框 */
function SourceToolbar({
  sourceMode,
  category,
  query,
  disableProblemsDisabled,
  onSourceModeChange,
  onSelectEnabledSources,
  onRequestDisableProblems,
  onCategoryChange,
  onQueryChange,
}: {
  sourceMode: "default" | "selected"
  category: string
  query: string
  disableProblemsDisabled: boolean
  onSourceModeChange: (mode: "default" | "selected") => void
  onSelectEnabledSources: () => void
  onRequestDisableProblems: () => void
  onCategoryChange: (category: string) => void
  onQueryChange: (query: string) => void
}) {
  return (
    <Toolbar
      leading={
        <>
          <div className="flex items-center" role="group" aria-label="来源范围">
            {sourceModes.map((mode) => {
              const active = sourceMode === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  aria-pressed={active}
                  className={adminTabClassName}
                  onClick={() => onSourceModeChange(mode.id)}
                >
                  {mode.label}
                  {active ? <ActiveUnderline layoutId="ai-news-source-mode" /> : null}
                </button>
              )
            })}
          </div>
          <ToolbarDivider />
          <div className="flex items-center gap-3">
            <button type="button" className={toolbarTextButtonClassName} onClick={onSelectEnabledSources}>
              选择已启用
            </button>
            <button
              type="button"
              className={toolbarTextButtonClassName}
              disabled={disableProblemsDisabled}
              onClick={onRequestDisableProblems}
            >
              停用异常源
            </button>
          </div>
          <ToolbarDivider />
          <div className="flex flex-wrap items-center" role="group" aria-label="来源分类">
            {groupFilters.map((filter) => {
              const active = category === filter.id
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={active}
                  className={adminTabClassName}
                  onClick={() => onCategoryChange(filter.id)}
                >
                  {filter.label}
                  {active ? <ActiveUnderline layoutId="ai-news-source-category" /> : null}
                </button>
              )
            })}
          </div>
        </>
      }
      trailing={
        <label className="relative block w-60">
          <span className="ed-visually-hidden">搜索来源</span>
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input
            className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-3 pl-8 text-base text-[var(--foreground)] transition-[border-color] duration-150 placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] md:text-sm"
            placeholder="搜索来源"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </label>
      }
    />
  )
}
