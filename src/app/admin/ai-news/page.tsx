"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel"
import { Button } from "@/components/ui/Button"

type RunResult = {
  operation: "created" | "skipped"
  reason?: string
  published: boolean
  sourceCount: number
  post?: { id: string; title: string; slug: string; published: boolean }
  autoReview?: { verdict?: "ready" | "needs-work"; score?: number; summary?: string; published: boolean; error?: string } | null
  failures?: Array<{ sourceId: string; message: string }>
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function readError(data: unknown) {
  if (data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string") {
    return (data as { error: string }).error
  }

  return "AI 日报生成失败"
}

export default function AdminAiNewsPage() {
  const [date, setDate] = useState(todayInputValue())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)

  async function runNewsGeneration() {
    setRunning(true)
    try {
      const response = await fetch("/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(readError(data))
      }

      setResult(data.data)
      if (data.data.operation === "skipped") {
        toast.message("今日 AI 日报已存在")
      } else if (data.data.published) {
        toast.success("AI 日报已生成并自动上线")
      } else {
        toast.success("AI 日报草稿已生成，等待人工检查")
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 日报生成失败")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI News"
        title="每日 AI 新闻推送"
        description="聚合固定 AI 新闻源，生成中文日报草稿，并通过 AI 审稿后自动上线。"
        action={
          <Button type="button" disabled={running} onClick={() => void runNewsGeneration()}>
            {running ? "生成中..." : "生成今日 AI 日报"}
          </Button>
        }
      />

      <WorkspacePanel title="第一版策略" description="固定来源 + 手动触发 + AI 审稿自动上线" className="border border-[var(--border)]">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            生成日期
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
            <p>流程：抓取 RSS/Atom → 去重 → AI 生成 Markdown 日报 → 创建草稿 → AI 审稿 → 达标自动发布。</p>
            <p className="mt-2">同一天使用固定 slug，重复触发不会重复创建文章。</p>
          </div>
        </div>
      </WorkspacePanel>

      {result ? (
        <WorkspacePanel title="最近一次运行" description={result.reason ?? "运行完成"} className="border border-[var(--border)]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge tone={result.published ? "success" : result.operation === "skipped" ? "warning" : "warning"}>
                {result.published ? "已上线" : result.operation === "skipped" ? "已存在" : "草稿"}
              </StatusBadge>
              <span className="text-sm text-[var(--muted)]">候选新闻 {result.sourceCount ?? 0} 条</span>
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

            {result.autoReview ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
                {result.autoReview.error ? (
                  <p>自动审稿失败：{result.autoReview.error}</p>
                ) : (
                  <p>
                    自动审稿：{result.autoReview.verdict} · {result.autoReview.score} 分 · {result.autoReview.summary}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </WorkspacePanel>
      ) : null}
    </div>
  )
}
