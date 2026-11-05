"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { Reveal } from "@/components/editorial";
import { cn } from "@/lib/cn";
import type { RunResult } from "./hooks/useAdminAiNews";

type AiNewsRunResultPanelProps = {
  result: RunResult;
};

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="whitespace-nowrap">
      <span className="text-[var(--text-muted)]">{label}</span>{" "}
      <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">{children}</span>
    </span>
  );
}

/**
 * 「最近一次运行」（方向 A 第 15 节 D2）：区块标题 + 原因，右侧语气色状态（已上线 success / 已存在 muted / 草稿 warning）；
 * 数据一行等宽 700；下面是文章行：衬线标题 + 等宽 slug，右侧「编辑文章」「查看前台」文字链接。
 * 只在本次手动运行后出现。
 */
export function AiNewsRunResultPanel({ result }: AiNewsRunResultPanelProps) {
  const statusLabel = result.published ? "已上线" : result.operation === "skipped" ? "已存在" : "草稿";
  const statusClassName = result.published
    ? "text-[var(--success)]"
    : result.operation === "skipped"
      ? "text-[var(--text-muted)]"
      : "text-[var(--warning)]";

  return (
    <Reveal as="section" aria-labelledby="ai-news-result-title" data-slot="ai-news-result">
      <AdminSectionHeader
        id="ai-news-result-title"
        title="最近一次运行"
        description={result.reason ?? "运行完成"}
        aside={<span className={cn("text-xs font-bold", statusClassName)}>{statusLabel}</span>}
      />

      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1.5 pt-3.5 text-[0.8125rem]">
        {result.metrics ? (
          <>
            <Metric label="原始">{result.metrics.rawCandidateCount}</Metric>
            <Metric label="去重">{result.metrics.dedupedCandidateCount}</Metric>
            <Metric label="入选">{result.metrics.selectedCandidateCount}</Metric>
          </>
        ) : (
          <Metric label="候选新闻">{result.sourceCount ?? 0} 条</Metric>
        )}
        {typeof result.metrics?.configuredSourceCount === "number" ? (
          <Metric label="来源">{result.metrics.configuredSourceCount} 个</Metric>
        ) : null}
        {typeof result.metrics?.qualityScore === "number" ? <Metric label="候选质量">{result.metrics.qualityScore} 分</Metric> : null}
        {result.generatedBy ? (
          <span className="whitespace-nowrap" title={result.generatedBy.name}>
            <span className="text-[var(--text-muted)]">生成模型</span>{" "}
            <span className="font-mono font-bold text-[var(--foreground)]">{result.generatedBy.model}</span>
          </span>
        ) : null}
        <Metric label="来源失败">{result.failures?.length ?? 0} 个</Metric>
      </div>

      {result.post ? (
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-y border-[var(--border)] py-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-base font-bold text-[var(--foreground)]">{result.post.title}</p>
            <p className="mt-0.5 truncate font-mono text-xs text-[var(--text-muted)]">/posts/{result.post.slug}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3.5">
            <Link className={adminTextActionClassName} href={`/admin/posts/${result.post.id}/edit`}>
              编辑文章
            </Link>
            {result.published ? (
              <Link className={adminTextActionClassName} href={`/posts/${result.post.slug}`}>
                查看前台
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Reveal>
  );
}
