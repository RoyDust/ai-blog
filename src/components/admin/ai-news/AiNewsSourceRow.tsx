"use client"

import { AnimatePresence, motion } from "motion/react"

import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes"
import { TableCell, TableRow } from "@/components/admin/ui"
import { collapseMotion } from "@/components/editorial"
import { cn } from "@/lib/cn"

import { AiNewsSourceTestResult } from "./AiNewsSourceTestResult"
import { aiNewsCategoryLabels, type AiNewsSourceTestResult as SourceTestResult, type PublicAiNewsSource } from "./types"

const typeLabels: Record<string, string> = {
  RSS: "RSS",
  HACKERNEWS: "HN",
  GITHUB_RELEASES: "GitHub",
  GITHUB_TRENDING_RSS: "Trending",
  REDDIT: "Reddit",
}

/** 状态语气色：默认启用 success、需关注 warning、默认停用 muted */
function statusToneClassName(source: PublicAiNewsSource) {
  if (!source.enabled) return "text-[var(--text-muted)]"
  if (source.healthWarnings.length > 0 || source.lastTestStatus === "failed") return "text-[var(--warning)]"
  return "text-[var(--success)]"
}

function sourceStatusLabel(source: PublicAiNewsSource) {
  if (!source.enabled) return "默认停用"
  if (source.healthWarnings.length > 0) return "需关注"
  return "默认启用"
}

function dash(value: number | null | undefined) {
  return value == null ? "—" : String(value)
}

function displayHost(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

/** 来源表列宽（table-fixed）：勾选 · 来源 · 类型分类 · 状态 · 权重 · 抓取候选入选 · 操作 */
export const aiNewsSourceColumns = ["w-9", "", "w-[7.5rem]", "w-[22%]", "w-14", "w-[13.5rem]", "w-[11.5rem]"] as const

/**
 * 来源表的一行（方向 A 第 15 节 + 17.3）：44px 单行，主值完整显示，同格说明（URL、分类、分数与失败数等）跟在后面截断。
 * 测试结果在行下展开：左侧 2px 语气色竖线缩进。
 */
export function AiNewsSourceRow({
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
  const categoryLabel = source.category ? aiNewsCategoryLabels[source.category] ?? source.category : "未分类"
  const warningNote = sourceMode === "selected" && selected && !source.enabled ? "本次临时使用" : source.healthWarnings[0]
  const statsNote = `分数 ${dash(source.minScore)} · 失败 ${stats.recentFailureCount} · 最近测试 ${dash(source.lastFetchedItemCount)}`

  return (
    <>
      <TableRow data-state={selected ? "selected" : undefined} data-source-id={source.id}>
        <TableCell className="pr-0">
          <input
            type="checkbox"
            className="ed-checkbox"
            checked={selected}
            aria-label={`${selected ? "取消选择" : "选择"} ${source.name}`}
            onChange={onToggleSelected}
          />
        </TableCell>
        <TableCell className="min-w-0 overflow-hidden">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 text-sm font-medium text-[var(--foreground)]">{source.name}</span>
            <a
              className="min-w-0 truncate font-mono text-xs text-[var(--text-muted)] hover:text-[var(--foreground)] hover:underline"
              href={source.url}
              target="_blank"
              rel="noreferrer"
              title={source.url}
            >
              {displayHost(source.url)}
            </a>
          </div>
        </TableCell>
        <TableCell className="overflow-hidden">
          <span className="inline-block w-14 truncate align-baseline font-mono text-xs font-bold text-[var(--foreground)]">{typeLabels[source.type] ?? source.type}</span>
          <span className="text-xs text-[var(--text-muted)]">{categoryLabel}</span>
        </TableCell>
        <TableCell className="overflow-hidden">
          <div className="flex min-w-0 items-baseline gap-2" title={source.healthWarnings.join("；") || undefined}>
            <span className={cn("shrink-0 text-xs font-bold", statusToneClassName(source))}>{sourceStatusLabel(source)}</span>
            {warningNote ? <span className="min-w-0 truncate text-xs text-[var(--warning)]">{warningNote}</span> : null}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">{source.weight}</TableCell>
        <TableCell className="overflow-hidden">
          <div className="flex min-w-0 items-baseline gap-2" title={statsNote}>
            <span className="shrink-0 font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">
              {dash(source.fetchLimit)} · {stats.recentCandidateCount} · {stats.recentSelectedCount}
            </span>
            <span className="min-w-0 truncate font-mono text-[0.6875rem] text-[var(--text-muted)]">{statsNote}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-busy={testing || undefined}
              className={adminTextActionClassName}
              disabled={testing}
              onClick={onTest}
            >
              {testing ? "测试中" : "测试"}
            </button>
            <button type="button" className={adminTextActionClassName} onClick={onEdit}>
              编辑
            </button>
            <button type="button" className={adminTextActionClassName} onClick={onToggleEnabled}>
              {source.enabled ? "停用" : "启用"}
            </button>
            <button
              type="button"
              className={adminTextActionDangerClassName}
              disabled={!source.deletable || deleting}
              title={!source.deletable ? "内置来源不可删除" : undefined}
              onClick={onDelete}
            >
              删除
            </button>
          </div>
        </TableCell>
      </TableRow>
      <AnimatePresence initial={false}>
        {testResult ? (
          <tr key="test-result" className="border-b border-[var(--border)] hover:bg-transparent">
            <td />
            <td colSpan={aiNewsSourceColumns.length - 1} className="p-0">
              <motion.div {...collapseMotion} className="overflow-hidden">
                <div className="pt-1 pb-3 pr-2">
                  <AiNewsSourceTestResult result={testResult} />
                </div>
              </motion.div>
            </td>
          </tr>
        ) : null}
      </AnimatePresence>
    </>
  )
}
