"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import type { RunResult } from "./hooks/useAdminAiNews";

type AiNewsRunResultPanelProps = {
  result: RunResult;
};

/**
 * 「最近一次运行」结果面板：上线状态、漏斗指标、生成模型与失败摘要。
 * 纯展示组件。
 */
export function AiNewsRunResultPanel({ result }: AiNewsRunResultPanelProps) {
  return (
    <WorkspacePanel title="最近一次运行" description={result.reason ?? "运行完成"} className="border border-[var(--border)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={result.published ? "success" : result.operation === "skipped" ? "warning" : "warning"}>
            {result.published ? "已上线" : result.operation === "skipped" ? "已存在" : "草稿"}
          </StatusBadge>
          <span className="text-sm text-[var(--muted)]">
            {result.metrics
              ? `原始 ${result.metrics.rawCandidateCount} · 去重 ${result.metrics.dedupedCandidateCount} · 入选 ${result.metrics.selectedCandidateCount}`
              : `候选新闻 ${result.sourceCount ?? 0} 条`}
          </span>
          {typeof result.metrics?.configuredSourceCount === "number" ? (
            <span className="text-sm text-[var(--muted)]">来源 {result.metrics.configuredSourceCount} 个</span>
          ) : null}
          {typeof result.metrics?.qualityScore === "number" ? (
            <span className="text-sm text-[var(--muted)]">候选质量 {result.metrics.qualityScore} 分</span>
          ) : null}
          {result.generatedBy ? (
            <span className="text-sm text-[var(--muted)]">
              生成模型 {result.generatedBy.name}（{result.generatedBy.model}）
            </span>
          ) : null}
          {result.failures?.length ? <span className="text-sm text-[var(--muted)]">来源失败 {result.failures.length} 个</span> : null}
        </div>

        {result.post ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="font-semibold text-[var(--foreground)]">{result.post.title}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">/posts/{result.post.slug}</p>
            <div className="mt-3 flex gap-3 text-sm">
              <Link className="text-[var(--brand)] hover:underline" href={`/admin/posts/${result.post.id}/edit`}>
                编辑文章
              </Link>
              {result.published ? (
                <Link className="text-[var(--brand)] hover:underline" href={`/posts/${result.post.slug}`}>
                  查看前台
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </WorkspacePanel>
  );
}
