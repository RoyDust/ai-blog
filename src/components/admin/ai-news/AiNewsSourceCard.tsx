"use client"

import { Check, Pencil, Power, TestTube2, Trash2 } from "lucide-react"

import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { Button } from "@/components/admin/ui"

import { AiNewsSourceTestResult } from "./AiNewsSourceTestResult"
import type { AiNewsSourceTestResult as SourceTestResult, PublicAiNewsSource } from "./types"

const typeLabels: Record<string, string> = {
  RSS: "RSS",
  HACKERNEWS: "HN",
  GITHUB_RELEASES: "GitHub",
  GITHUB_TRENDING_RSS: "Trending",
  REDDIT: "Reddit",
}

function statusTone(source: PublicAiNewsSource) {
  if (!source.enabled) return "neutral"
  if (source.healthWarnings.length > 0 || source.lastTestStatus === "failed") return "warning"
  return "success"
}

function sourceStatusLabel(source: PublicAiNewsSource) {
  if (!source.enabled) return "默认停用"
  if (source.healthWarnings.length > 0) return "需关注"
  return "默认启用"
}

export function AiNewsSourceCard({
  source,
  selected,
  sourceMode,
  testing,
  deleting,
  testResult,
  onToggleSelected,
  onToggleEnabled,
  onEdit,
  onDelete,
  onTest,
}: {
  source: PublicAiNewsSource
  selected: boolean
  sourceMode: "default" | "selected"
  testing: boolean
  deleting: boolean
  testResult?: SourceTestResult
  onToggleSelected: () => void
  onToggleEnabled: () => void
  onEdit: () => void
  onDelete: () => void
  onTest: () => void
}) {
  const stats = source.stats

  return (
    <article className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--border-strong)]">
      <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-start">
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${selected ? "取消选择" : "选择"} ${source.name}`}
          onClick={onToggleSelected}
          className={`mt-1 flex h-5 w-5 items-center justify-center rounded border text-[10px] transition ${
            selected ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-strong)] bg-[var(--surface-alt)]"
          }`}
        >
          {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
        </button>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-[var(--foreground)]">{source.name}</h3>
            <StatusBadge tone={statusTone(source)}>{sourceStatusLabel(source)}</StatusBadge>
            {sourceMode === "selected" && selected && !source.enabled ? <StatusBadge tone="warning">本次临时使用</StatusBadge> : null}
            <StatusBadge>{typeLabels[source.type] ?? source.type}</StatusBadge>
            {source.category ? <StatusBadge>{source.category}</StatusBadge> : null}
          </div>
          <a className="mt-2 block truncate text-xs text-[var(--brand)] hover:underline" href={source.url} target="_blank" rel="noreferrer">
            {source.url}
          </a>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
            <span>权重 {source.weight}</span>
            {source.fetchLimit ? <span>抓取 {source.fetchLimit}</span> : null}
            {source.minScore ? <span>分数 {source.minScore}</span> : null}
            <span>候选 {stats.recentCandidateCount}</span>
            <span>入选 {stats.recentSelectedCount}</span>
            <span>失败 {stats.recentFailureCount}</span>
            {source.lastFetchedItemCount != null ? <span>最近测试 {source.lastFetchedItemCount}</span> : null}
          </div>
          {source.healthWarnings.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {source.healthWarnings.map((warning) => (
                <span key={warning} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
                  {warning}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 md:justify-end">
          <Button type="button" size="sm" variant="outline" disabled={testing} onClick={onTest}>
            <TestTube2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {testing ? "测试中" : "测试"}
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={onEdit}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
            编辑
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onToggleEnabled}>
            <Power className="mr-2 h-4 w-4" aria-hidden="true" />
            {source.enabled ? "停用" : "启用"}
          </Button>
          <Button type="button" size="sm" variant="danger" disabled={!source.deletable || deleting} onClick={onDelete}>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            删除
          </Button>
        </div>
      </div>

      {testResult ? <AiNewsSourceTestResult result={testResult} /> : null}
    </article>
  )
}
