"use client";

import Link from "next/link";
import { Button } from "@/components/admin/ui";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import type { CandidateState, RunHistoryItem } from "./hooks/useAdminAiNews";

function runStatusMeta(status: RunHistoryItem["status"]): { label: string; tone: "neutral" | "success" | "warning" | "danger" } {
  switch (status) {
    case "SUCCEEDED":
      return { label: "已完成", tone: "success" }
    case "FAILED":
      return { label: "生成失败", tone: "danger" }
    case "RUNNING":
      return { label: "运行中", tone: "warning" }
    case "SKIPPED":
      return { label: "已跳过", tone: "warning" }
  }
}

function runTriggerLabel(trigger: RunHistoryItem["trigger"]) {
  return trigger === "CRON" ? "定时" : "手动"
}

function runCandidateFunnel(run: Pick<RunHistoryItem, "sourceCount" | "rawCandidateCount" | "dedupedCandidateCount" | "selectedCandidateCount">) {
  const raw = run.rawCandidateCount ?? run.sourceCount ?? 0
  const deduped = run.dedupedCandidateCount ?? raw
  const selected = run.selectedCandidateCount ?? 0

  return `原始 ${raw} · 去重 ${deduped} · 入选 ${selected}`
}

function runSourceSummary(run: Pick<RunHistoryItem, "sourceSnapshotJson">) {
  const sources = Array.isArray(run.sourceSnapshotJson) ? run.sourceSnapshotJson : []
  if (sources.length === 0) return null

  return `来源 ${sources.length}`
}

type AiNewsRunHistoryPanelProps = {
  runs: RunHistoryItem[];
  runsLoading: boolean;
  runsError: unknown;
  candidateStates: Record<string, CandidateState>;
  onToggleCandidates: (runId: string) => void;
};

/**
 * 「运行记录」面板：最近运行列表与候选明细懒加载。
 * 纯展示组件，候选展开动作经回调上抛。
 */
export function AiNewsRunHistoryPanel({
  runs,
  runsLoading,
  runsError,
  candidateStates,
  onToggleCandidates,
}: AiNewsRunHistoryPanelProps) {
  return (
    <WorkspacePanel
      title="运行记录"
      description={runsLoading ? "正在加载最近运行状态" : "最近 20 次手动或定时生成结果"}
      className="border border-[var(--border)]"
    >
      <div className="space-y-3">
        {runsError ? <p className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-surface)] p-3 text-sm text-[var(--danger-foreground)]">{String(runsError)}</p> : null}
        {!runsError && runs.length === 0 ? <p className="text-sm text-[var(--muted)]">暂无运行记录。</p> : null}

        {runs.map((run) => {
          const meta = runStatusMeta(run.status)
          const candidates = candidateStates[run.id]
          return (
            <div key={run.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                <span className="text-sm text-[var(--muted)]">{runTriggerLabel(run.trigger)}</span>
                <span className="text-sm text-[var(--muted)]">{run.runDate.slice(0, 10)}</span>
                <span className="text-sm text-[var(--muted)]">{runCandidateFunnel(run)}</span>
                {runSourceSummary(run) ? <span className="text-sm text-[var(--muted)]">{runSourceSummary(run)}</span> : null}
                {run.failureCount ? <span className="text-sm text-[var(--muted)]">失败 {run.failureCount} 个</span> : null}
                {typeof run.qualityScore === "number" ? <span className="text-sm text-[var(--muted)]">质量 {run.qualityScore} 分</span> : null}
                {run.durationMs ? <span className="text-sm text-[var(--muted)]">{Math.round(run.durationMs / 1000)} 秒</span> : null}
                <Button type="button" variant="outline" onClick={() => onToggleCandidates(run.id)}>
                  {candidates?.expanded ? "收起候选" : "展开候选"}
                </Button>
              </div>

              {run.error ? <p className="mt-3 text-sm text-[var(--danger-foreground)]">{run.error}</p> : null}
              {typeof run.reviewScore === "number" ? <p className="mt-2 text-sm text-[var(--muted)]">审稿得分 {run.reviewScore}</p> : null}

              {run.postId || run.postSlug ? (
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {run.postId ? (
                    <Link className="text-[var(--brand)] hover:underline" href={`/admin/posts/${run.postId}/edit`}>
                      编辑
                    </Link>
                  ) : null}
                  {run.postSlug && run.published ? (
                    <Link className="text-[var(--brand)] hover:underline" href={`/posts/${run.postSlug}`}>
                      查看文章
                    </Link>
                  ) : null}
                </div>
              ) : null}

              {candidates?.expanded ? (
                <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  {candidates.loading ? <p className="text-sm text-[var(--muted)]">候选加载中...</p> : null}
                  {candidates.error ? <p className="rounded-2xl border border-[var(--danger-border)] bg-[var(--danger-surface)] p-3 text-sm text-[var(--danger-foreground)]">{candidates.error}</p> : null}
                  {!candidates.loading && !candidates.error && candidates.data?.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">暂无候选。</p>
                  ) : null}
                  {candidates.data?.map((candidate) => (
                    <div key={candidate.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                        <StatusBadge tone={candidate.selected ? "success" : "neutral"}>
                          {candidate.selected ? "入选" : "未入选"}
                        </StatusBadge>
                        <span>{candidate.aiScore == null ? "未评分" : `${candidate.aiScore} 分`}</span>
                        <span>{candidate.sourceType}</span>
                        <span>{candidate.sourceName}</span>
                        <span>引用 {candidate.citationCount}</span>
                      </div>
                      <a
                        className="mt-2 block text-sm font-semibold text-[var(--brand)] hover:underline"
                        href={candidate.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {candidate.title}
                      </a>
                      {candidate.aiReason ? <p className="mt-2 text-sm text-[var(--muted)]">{candidate.aiReason}</p> : null}
                      {candidate.aiTags.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {candidate.aiTags.map((tag) => (
                            <span key={tag} className="rounded-full border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {candidate.duplicateOfId ? <p className="mt-2 text-xs text-[var(--muted)]">重复于 {candidate.duplicateOfId}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </WorkspacePanel>
  );
}
