"use client"

import { Plus, RefreshCw, Search, ShieldAlert } from "lucide-react"
import { useState } from "react"

import { AdminPagination } from "@/components/admin/primitives/AdminPagination"
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel"
import { Button } from "@/components/admin/ui"

import { AiNewsSourceCard } from "./AiNewsSourceCard"
import { AiNewsSourceFormDialog } from "./AiNewsSourceFormDialog"
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
  onDeleteSource: (source: PublicAiNewsSource) => void
  onTestSource: (source: PublicAiNewsSource) => void
  onDisableProblemSources: () => void
}

const groupFilters = [
  { id: "all", label: "全部" },
  { id: "official", label: "官方" },
  { id: "industry", label: "媒体" },
  { id: "developer", label: "开发者" },
  { id: "community", label: "社区" },
  { id: "github-release", label: "GitHub" },
]

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

  const selectedCount = selectedSourceIds.length
  const enabledCount = summary.enabledCount
  const problemCount = sources.filter((source) => source.enabled && source.healthWarnings.length > 0).length

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

  return (
    <WorkspacePanel
      title="来源控制台"
      description={`默认启用 ${enabledCount} 个来源；当前选择 ${selectedCount} 个来源；匹配 ${pagination.total} 个来源。`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onReload} disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            刷新
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            新增来源
          </Button>
        </div>
      }
      className="border border-[var(--border)]"
    >
      <div className="space-y-4">
        {message ? <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
        {error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sourceMode === "default" ? "secondary" : "outline"}
              onClick={() => onSourceModeChange("default")}
            >
              默认来源
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sourceMode === "selected" ? "secondary" : "outline"}
              onClick={() => onSourceModeChange("selected")}
            >
              选中来源
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onSelectEnabledSources}>
              选择已启用
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={problemCount === 0 || saving} onClick={onDisableProblemSources}>
              <ShieldAlert className="mr-2 h-4 w-4" aria-hidden="true" />
              停用异常源
            </Button>
          </div>

          <label className="relative block min-w-[240px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden="true" />
            <input
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand)]"
              placeholder="搜索来源"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          {groupFilters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={category === filter.id ? "secondary" : "outline"}
              onClick={() => onCategoryChange(filter.id)}
            >
              {filter.label}
            </Button>
          ))}
        </div>

        {loading ? <p className="text-sm text-[var(--muted)]">来源加载中...</p> : null}
        {!loading && sources.length === 0 ? <p className="text-sm text-[var(--muted)]">没有匹配的来源。</p> : null}

        <div className="grid gap-3">
          {sources.map((source) => (
            <AiNewsSourceCard
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
              onDelete={() => onDeleteSource(source)}
              onTest={() => onTestSource(source)}
            />
          ))}
        </div>

        {pagination.total > 0 ? (
          <AdminPagination
            className="rounded-lg border border-[var(--border)]"
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
      </div>

      <AiNewsSourceFormDialog
        key={formKey}
        open={formOpen}
        source={editingSource}
        saving={saving}
        onOpenChange={setFormOpen}
        onSubmit={onSaveSource}
      />
    </WorkspacePanel>
  )
}
