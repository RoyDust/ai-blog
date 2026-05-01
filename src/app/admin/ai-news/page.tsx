"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel"
import { Button } from "@/components/admin/ui"
import type { PublicAiModelOption } from "@/lib/ai-models"

type RunHistoryItem = {
  id: string
  runDate: string
  trigger: "MANUAL" | "CRON"
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
  sourceCount: number
  failureCount: number
  error?: string | null
  postId?: string | null
  postSlug?: string | null
  published: boolean
  reviewScore?: number | null
  createdAt: string
  durationMs?: number | null
}

type RunResult = {
  operation: "created" | "skipped" | "regenerated"
  reason?: string
  published: boolean
  sourceCount: number
  post?: { id: string; title: string; slug: string; published: boolean }
  generatedBy?: { id: string; name: string; model: string }
  autoReview?: { verdict?: "ready" | "needs-work"; score?: number; summary?: string; published: boolean; error?: string } | null
  failures?: Array<{ sourceId: string; message: string }>
  run?: { id: string; status: RunHistoryItem["status"] }
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

function getDefaultNewsModel(models: PublicAiModelOption[]) {
  return (
    models.find((model) => model.status === "ready" && model.defaultFor.includes("post-summary")) ??
    models.find((model) => model.status === "ready" && model.capabilities.includes("post-summary")) ??
    null
  )
}

function modelStatusLabel(model: PublicAiModelOption) {
  if (model.status === "ready") return model.defaultFor.includes("post-summary") ? "默认" : "可用"
  if (model.status === "disabled") return "已停用"
  return "缺少密钥"
}

export default function AdminAiNewsPage() {
  const [date, setDate] = useState(todayInputValue())
  const [models, setModels] = useState<PublicAiModelOption[]>([])
  const [selectedModelId, setSelectedModelId] = useState("")
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<RunResult | null>(null)
  const [runs, setRuns] = useState<RunHistoryItem[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  const readyModels = useMemo(
    () => models.filter((model) => model.status === "ready" && model.capabilities.includes("post-summary")),
    [models],
  )

  const loadRunHistory = useCallback(async () => {
    setRunsLoading(true)
    setRunsError(null)
    try {
      const response = await fetch("/api/admin/ai-news/run")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(readError(data))
      }

      setRuns(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "运行记录加载失败")
    } finally {
      setRunsLoading(false)
    }
  }, [])

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const response = await fetch("/api/admin/ai/models")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(readError(data))
      }

      const nextModels = Array.isArray(data.data) ? data.data : []
      setModels(nextModels)
      setSelectedModelId((current) => current || getDefaultNewsModel(nextModels)?.id || "")
    } catch (error) {
      setModelsError(error instanceof Error ? error.message : "模型列表加载失败")
    } finally {
      setModelsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRunHistory()
    void loadModels()
  }, [loadModels, loadRunHistory])

  async function runNewsGeneration(regenerate = false) {
    if (!selectedModelId) {
      toast.error("请选择可用模型")
      return
    }

    setRunning(true)
    try {
      const response = await fetch("/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, modelId: selectedModelId, ...(regenerate ? { regenerate: true } : {}) }),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(readError(data))
      }

      setResult(data.data)
      await loadRunHistory()
      if (data.data.operation === "skipped") {
        toast.message("今日 AI 日报已存在")
      } else if (data.data.operation === "regenerated" && data.data.published) {
        toast.success("AI 日报已重新生成并上线")
      } else if (data.data.operation === "regenerated") {
        toast.success("AI 日报已重新生成，等待人工检查")
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
          <>
            <Button type="button" disabled={running || !selectedModelId} onClick={() => void runNewsGeneration()}>
              {running ? "生成中..." : "生成今日 AI 日报"}
            </Button>
            <Button type="button" variant="outline" disabled={running || !selectedModelId} onClick={() => void runNewsGeneration(true)}>
              重新生成今日日报
            </Button>
          </>
        }
      />

      <WorkspacePanel title="第一版策略" description="固定来源 + 手动触发 + AI 审稿自动上线" className="border border-[var(--border)]">
        <div className="grid gap-4 xl:grid-cols-[220px_minmax(280px,360px)_1fr]">
          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            生成日期
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
            />
          </label>
          <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
            生成模型
            <select
              value={selectedModelId}
              onChange={(event) => setSelectedModelId(event.target.value)}
              disabled={modelsLoading || readyModels.length === 0}
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {modelsLoading ? <option value="">模型加载中</option> : null}
              {!modelsLoading && readyModels.length === 0 ? <option value="">暂无可用模型</option> : null}
              {models.map((model) => (
                <option key={model.id} value={model.id} disabled={model.status !== "ready" || !model.capabilities.includes("post-summary")}>
                  {model.name} · {model.model} · {modelStatusLabel(model)}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
            <p>流程：抓取 RSS/Atom → 去重 → AI 生成 Markdown 日报 → 创建草稿 → AI 审稿 → 达标自动发布。</p>
            <p className="mt-2">同一天使用固定 slug，重复触发不会重复创建文章。</p>
            <p className="mt-2">重新生成会覆盖同日已存在日报内容，并保留原文章链接。</p>
            {selectedModel ? (
              <p className="mt-2">
                当前模型：{selectedModel.name}（{selectedModel.model}）。
              </p>
            ) : null}
            {modelsError ? <p className="mt-2 text-red-600">{modelsError}</p> : null}
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

      <WorkspacePanel
        title="运行记录"
        description={runsLoading ? "正在加载最近运行状态" : "最近 20 次手动或定时生成结果"}
        className="border border-[var(--border)]"
      >
        <div className="space-y-3">
          {runsError ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{runsError}</p> : null}
          {!runsError && runs.length === 0 ? <p className="text-sm text-[var(--muted)]">暂无运行记录。</p> : null}

          {runs.map((run) => {
            const meta = runStatusMeta(run.status)
            return (
              <div key={run.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <span className="text-sm text-[var(--muted)]">{runTriggerLabel(run.trigger)}</span>
                  <span className="text-sm text-[var(--muted)]">{run.runDate.slice(0, 10)}</span>
                  <span className="text-sm text-[var(--muted)]">来源 {run.sourceCount ?? 0} 条</span>
                  {run.failureCount ? <span className="text-sm text-[var(--muted)]">失败 {run.failureCount} 个</span> : null}
                  {run.durationMs ? <span className="text-sm text-[var(--muted)]">{Math.round(run.durationMs / 1000)} 秒</span> : null}
                </div>

                {run.error ? <p className="mt-3 text-sm text-red-600">{run.error}</p> : null}
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
              </div>
            )
          })}
        </div>
      </WorkspacePanel>
    </div>
  )
}
