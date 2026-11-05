"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { Fragment, useLayoutEffect, useRef, useState } from "react";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui";
import { InlineSpinner } from "@/components/admin/workspace/WorkspaceKit";
import { SkeletonBar, collapseMotion } from "@/components/editorial";
import { cn } from "@/lib/cn";
import type { CandidateState, RunCandidateItem, RunHistoryItem } from "./hooks/useAdminAiNews";

type Tone = "success" | "danger" | "info" | "muted";

const toneClassNames: Record<Tone, string> = {
  success: "text-[var(--success)]",
  danger: "text-[var(--danger-foreground)]",
  info: "text-[var(--focus)]",
  muted: "text-[var(--text-muted)]",
};

function runStatusMeta(status: RunHistoryItem["status"]): { label: string; tone: Tone } {
  switch (status) {
    case "SUCCEEDED":
      return { label: "已完成", tone: "success" };
    case "FAILED":
      return { label: "生成失败", tone: "danger" };
    case "RUNNING":
      return { label: "运行中", tone: "info" };
    case "SKIPPED":
      return { label: "已跳过", tone: "muted" };
  }
}

function runTriggerLabel(trigger: RunHistoryItem["trigger"]) {
  return trigger === "CRON" ? "定时" : "手动";
}

function dash(value: number | null | undefined) {
  return typeof value === "number" ? String(value) : "—";
}

/** 原始 · 去重 · 入选：运行中 / 已跳过且没有数字时统一写「—」 */
function runCandidateFunnel(run: Pick<RunHistoryItem, "status" | "sourceCount" | "rawCandidateCount" | "dedupedCandidateCount" | "selectedCandidateCount">) {
  if ((run.status === "RUNNING" || run.status === "SKIPPED") && run.rawCandidateCount == null) {
    return "— · — · —";
  }
  const raw = run.rawCandidateCount ?? run.sourceCount ?? 0;
  const deduped = run.dedupedCandidateCount ?? raw;
  const selected = run.selectedCandidateCount ?? 0;

  return `${raw} · ${deduped} · ${selected}`;
}

function runSourceCount(run: Pick<RunHistoryItem, "sourceSnapshotJson">) {
  const sources = Array.isArray(run.sourceSnapshotJson) ? run.sourceSnapshotJson : [];
  return sources.length > 0 ? sources.length : null;
}

const columns = ["w-[5.5rem]", "w-[10rem]", "", "w-[9.5rem]", "w-[10rem]", "w-[4.5rem]", "w-[13rem]"];
const heads = ["状态", "日期 · 触发", "原始 · 去重 · 入选", "来源 · 失败", "质量 · 审稿", "耗时", "操作"];

type AiNewsRunHistoryPanelProps = {
  runs: RunHistoryItem[];
  runsLoading: boolean;
  runsError: unknown;
  candidateStates: Record<string, CandidateState>;
  onToggleCandidates: (runId: string) => void;
};

/**
 * 「运行记录」（方向 A 第 15 节 + 17.3）：一次运行一行（44px），失败行下面一行 danger 错误摘要；
 * 「展开候选」在行下展开候选表（左侧 2px 竖线缩进），候选加载失败可重试。
 * 纯展示组件，候选展开动作经回调上抛。
 */
export function AiNewsRunHistoryPanel({
  runs,
  runsLoading,
  runsError,
  candidateStates,
  onToggleCandidates,
}: AiNewsRunHistoryPanelProps) {
  // 重试 = 收起后重新展开（数据层首次展开才请求）；第二次调用要用父组件重渲染后的最新回调
  const toggleRef = useRef(onToggleCandidates);
  useLayoutEffect(() => {
    toggleRef.current = onToggleCandidates;
  });
  const [retryingIds, setRetryingIds] = useState<string[]>([]);

  const retryCandidates = (runId: string) => {
    setRetryingIds((ids) => [...ids, runId]);
    onToggleCandidates(runId);
    window.setTimeout(() => {
      toggleRef.current(runId);
      setRetryingIds((ids) => ids.filter((id) => id !== runId));
    }, 0);
  };

  const showSkeleton = runsLoading && runs.length === 0 && !runsError;

  return (
    <section aria-labelledby="ai-news-runs-title" data-slot="ai-news-runs">
      <AdminSectionHeader
        id="ai-news-runs-title"
        title="运行记录"
        description={runsLoading ? "正在加载最近运行状态" : "最近 20 次手动或定时生成结果"}
      />

      <Table className="mt-2 table-fixed" aria-busy={runsLoading || undefined}>
        <colgroup>
          {columns.map((width, index) => (
            <col key={index} className={width || undefined} />
          ))}
        </colgroup>
        <TableHeader>
          <TableRow>
            {heads.map((head) => (
              <TableHead key={head} className={head === "耗时" ? "text-right" : undefined}>
                {head}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {showSkeleton
            ? Array.from({ length: 4 }, (_, index) => (
                <TableRow key={`skeleton-${index}`} aria-hidden="true">
                  {columns.map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <SkeletonBar className={cn("h-3", cellIndex === 2 ? "w-28" : cellIndex === 5 ? "ml-auto w-8" : "w-16")} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : null}

          {runsError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={heads.length} className="h-auto py-6 whitespace-normal">
                <div role="alert" className="flex flex-col items-start gap-1">
                  <p className="ed-empty__title ed-empty__title--danger">运行记录加载失败</p>
                  <p className="text-[0.8125rem] text-[var(--text-muted)]">{String(runsError)}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {!runsLoading && !runsError && runs.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={heads.length} className="h-auto py-6">
                <p className="ed-empty__title">暂无运行记录。</p>
              </TableCell>
            </TableRow>
          ) : null}

          {runs.map((run) => {
            const meta = runStatusMeta(run.status);
            const candidates = candidateStates[run.id];
            const retrying = retryingIds.includes(run.id);
            const expanded = Boolean(candidates?.expanded) || retrying;
            const sourceCount = runSourceCount(run);

            return (
              <Fragment key={run.id}>
                <TableRow className={cn(run.error && "border-b-0")}>
                  <TableCell>
                    <span className={cn("text-xs font-bold", toneClassNames[meta.tone])}>{meta.label}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">{run.runDate.slice(0, 10)}</span>
                    <span className="ml-1.5 text-xs text-[var(--text-muted)]">{runTriggerLabel(run.trigger)}</span>
                  </TableCell>
                  <TableCell className="font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">{runCandidateFunnel(run)}</TableCell>
                  <TableCell className="text-[0.8125rem]">
                    <span className="text-[var(--text-muted)]">来源</span>{" "}
                    <span className="font-mono text-[var(--foreground)] tabular-nums">{dash(sourceCount)}</span>
                    <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                      失败 <span className="font-mono">{run.status === "RUNNING" && !run.failureCount ? 0 : dash(run.failureCount)}</span> 个
                    </span>
                  </TableCell>
                  <TableCell className="text-[0.8125rem]">
                    <span className="text-[var(--text-muted)]">质量</span>{" "}
                    <span className="font-mono text-[var(--foreground)] tabular-nums">{dash(run.qualityScore)}</span>
                    {typeof run.qualityScore === "number" ? <span className="text-[var(--text-muted)]"> 分</span> : null}
                    <span className="ml-1.5 text-xs text-[var(--text-muted)]">
                      审稿 <span className="font-mono">{dash(run.reviewScore)}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">
                    {run.durationMs ? (
                      <>
                        {Math.round(run.durationMs / 1000)} <span className="font-sans text-xs text-[var(--text-muted)]">秒</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={`ai-news-run-${run.id}-candidates`}
                        className={adminTextActionClassName}
                        onClick={() => onToggleCandidates(run.id)}
                      >
                        {expanded ? "收起候选" : "展开候选"}
                      </button>
                      {run.postId ? (
                        <Link className={adminTextActionClassName} href={`/admin/posts/${run.postId}/edit`}>
                          编辑
                        </Link>
                      ) : null}
                      {run.postSlug && run.published ? (
                        <Link className={adminTextActionClassName} href={`/posts/${run.postSlug}`}>
                          查看文章
                        </Link>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>

                {run.error ? (
                  <tr className="border-b border-[var(--border)]">
                    <td />
                    <td colSpan={heads.length - 1} className="px-2 pb-2.5">
                      <p role="alert" className="truncate text-xs text-[var(--danger-foreground)]" title={run.error}>
                        {run.error}
                      </p>
                    </td>
                  </tr>
                ) : null}

                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.tr key="candidates" id={`ai-news-run-${run.id}-candidates`} className="border-b border-[var(--border)]" exit={{ opacity: 0 }}>
                      <td />
                      <td colSpan={heads.length - 1} className="p-0">
                        <motion.div {...collapseMotion} className="overflow-hidden">
                          <div className="my-2 mr-2 border-l-2 border-[var(--reader-border-strong)] pl-4">
                            <RunCandidates
                              state={candidates}
                              retrying={retrying}
                              onRetry={() => retryCandidates(run.id)}
                            />
                          </div>
                        </motion.div>
                      </td>
                    </motion.tr>
                  ) : null}
                </AnimatePresence>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}

function RunCandidates({ state, retrying, onRetry }: { state?: CandidateState; retrying: boolean; onRetry: () => void }) {
  if (!state || state.loading || retrying) {
    return (
      <p role="status" className="flex items-center gap-2 py-2 text-[0.8125rem] text-[var(--text-muted)]">
        <InlineSpinner />
        候选加载中...
      </p>
    );
  }

  if (state.error) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2.5 py-2">
        <p className="ed-empty__title ed-empty__title--danger">{state.error}</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry}>
          重试
        </Button>
      </div>
    );
  }

  if (!state.data || state.data.length === 0) {
    return <p className="ed-empty__title py-2">暂无候选。</p>;
  }

  return (
    <table className="w-full table-fixed text-[0.8125rem]">
      <colgroup>
        <col className="w-16" />
        <col className="w-16" />
        <col />
        <col className="w-[13rem]" />
      </colgroup>
      <thead>
        <tr className="border-b border-[var(--border)] text-left text-xs font-bold text-[var(--text-muted)]">
          <th scope="col" className="h-8 font-bold">结果</th>
          <th scope="col" className="h-8 font-bold">分数</th>
          <th scope="col" className="h-8 font-bold">标题 · 理由</th>
          <th scope="col" className="h-8 font-bold">来源 · 引用</th>
        </tr>
      </thead>
      <tbody>
        {state.data.map((candidate) => (
          <CandidateRow key={candidate.id} candidate={candidate} />
        ))}
      </tbody>
    </table>
  );
}

function CandidateRow({ candidate }: { candidate: RunCandidateItem }) {
  return (
    <tr className="border-b border-[var(--border)] align-top last:border-b-0">
      <td className={cn("py-2.5 text-xs font-bold", candidate.selected ? "text-[var(--success)]" : "text-[var(--text-muted)]")}>
        {candidate.selected ? "入选" : "未入选"}
      </td>
      <td className="py-2.5">
        {candidate.aiScore == null ? (
          <span className="text-xs text-[var(--text-muted)]">未评分</span>
        ) : (
          <span className="font-mono text-[var(--foreground)] tabular-nums">
            {candidate.aiScore} <span className="font-sans text-xs text-[var(--text-muted)]">分</span>
          </span>
        )}
      </td>
      <td className="min-w-0 py-2.5 pr-4">
        <a
          className="font-medium text-[var(--foreground)] underline decoration-transparent underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-[var(--accent-sky)]"
          href={candidate.url}
          target="_blank"
          rel="noreferrer"
        >
          {candidate.title}
        </a>
        {candidate.aiReason ? <p className="mt-0.5 text-xs leading-5 text-[var(--text-body)]">{candidate.aiReason}</p> : null}
        {candidate.aiTags.length ? (
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            标签：
            {candidate.aiTags.map((tag, index) => (
              <Fragment key={tag}>
                {index > 0 ? " · " : null}
                <span>{tag}</span>
              </Fragment>
            ))}
          </p>
        ) : null}
        {candidate.duplicateOfId ? (
          <p className="mt-0.5 font-mono text-[0.6875rem] text-[var(--warning)]">重复于 {candidate.duplicateOfId}</p>
        ) : null}
      </td>
      <td className="py-2.5 text-xs text-[var(--text-body)]">
        <p className="truncate">
          {candidate.sourceType} · {candidate.sourceName}
        </p>
        <p className="mt-0.5 text-[var(--text-muted)]">
          引用 <span className="font-mono">{candidate.citationCount}</span>
        </p>
      </td>
    </tr>
  );
}
