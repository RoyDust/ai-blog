"use client"

/**
 * 后台 AI 日报控制台。
 *
 * 职责：
 * - 手动触发当日 AI 日报生成 / 重生成
 * - 展示可用模型、运行历史、候选新闻与生成结果
 * - 作为人工观察“抓取 → 去重 → 生成 → 审稿 → 发布”流水线的主要界面
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { StatusBadge } from "@/components/admin/primitives/StatusBadge"
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel"
import { Button } from "@/components/admin/ui"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select"
import { getApiErrorMessage } from "@/lib/admin-api-client"
import type { PublicAiModelOption } from "@/lib/ai-models"

type RunHistoryItem = {
  id: string
  runDate: string
  trigger: "MANUAL" | "CRON"
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
  sourceCount: number
  failureCount: number
  rawCandidateCount?: number | null
  dedupedCandidateCount?: number | null
  scoredCandidateCount?: number | null
  selectedCandidateCount?: number | null
  qualityScore?: number | null
  citationCoverage?: number | null
  generationMode?: string | null
  error?: string | null
  postId?: string | null
  postSlug?: string | null
  published: boolean
  reviewScore?: number | null
  createdAt: string
  durationMs?: number | null
}

type RunCandidateItem = {
  id: string
  title: string
  url: string
  sourceType: string
  sourceName: string
  aiScore: number | null
  aiReason: string | null
  aiTags: string[]
  selected: boolean
  duplicateOfId: string | null
  citationCount: number
}

type CandidateState = {
  expanded: boolean
  loading: boolean
  error: string | null
  data: RunCandidateItem[] | null
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
  metrics?: {
    rawCandidateCount: number
    dedupedCandidateCount: number
    scoredCandidateCount: number
    selectedCandidateCount: number
    qualityScore?: number | null
    citationCoverage?: number | null
    generationMode?: string | null
  }
  run?: { id: string; status: RunHistoryItem["status"] }
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

const unavailableModelValue = "__unavailable_model__"
const adminSelectTriggerClassName = "w-full rounded-2xl border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60"
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"

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

function runCandidateFunnel(run: Pick<RunHistoryItem, "sourceCount" | "rawCandidateCount" | "dedupedCandidateCount" | "selectedCandidateCount">) {
  const raw = run.rawCandidateCount ?? run.sourceCount ?? 0
  const deduped = run.dedupedCandidateCount ?? raw
  const selected = run.selectedCandidateCount ?? 0

  return `原始 ${raw} · 去重 ${deduped} · 入选 ${selected}`
}

/**
 * AI 日报后台页面入口。
 * 负责协调模型列表、运行记录、候选明细和手动触发动作。
 */
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
  const [candidateStates, setCandidateStates] = useState<Record<string, CandidateState>>({})

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  const readyModels = useMemo(
    () => models.filter((model) => model.status === "ready" && model.capabilities.includes("post-summary")),
    [models],
  )

  /**
   * 加载 AI 日报运行历史，用于展示近几次生成结果与漏斗指标。
   */
  const loadRunHistory = useCallback(async () => {
    setRunsLoading(true)
    setRunsError(null)
    try {
      const response = await fetch("/api/admin/ai-news/run")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(getApiErrorMessage(data, "AI 日报生成失败"))
      }

      setRuns(Array.isArray(data.data) ? data.data : [])
    } catch (error) {
      setRunsError(error instanceof Error ? error.message : "运行记录加载失败")
    } finally {
      setRunsLoading(false)
    }
  }, [])

  /**
   * 加载可用于日报生成的模型列表，并自动选择默认模型。
   */
  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    setModelsError(null)
    try {
      const response = await fetch("/api/admin/ai/models")
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(getApiErrorMessage(data, "AI 日报生成失败"))
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

  /**
   * 展开或收起某次运行的候选新闻列表。
   * 首次展开时才请求服务端，避免页面首屏加载过重。
   */
  const toggleRunCandidates = useCallback(async (runId: string) => {
    const current = candidateStates[runId]
    if (current?.expanded) {
      setCandidateStates((states) => ({
        ...states,
        [runId]: { ...current, expanded: false },
      }))
      return
    }

    setCandidateStates((states) => ({
      ...states,
      [runId]: {
        expanded: true,
        loading: !states[runId]?.data,
        error: null,
        data: states[runId]?.data ?? null,
      },
    }))

    if (current?.data) {
      return
    }

    try {
      const response = await fetch(`/api/admin/ai-news/candidates?runId=${encodeURIComponent(runId)}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(getApiErrorMessage(data, "AI 日报生成失败"))
      }

      setCandidateStates((states) => ({
        ...states,
        [runId]: {
          expanded: true,
          loading: false,
          error: null,
          data: Array.isArray(data.data) ? data.data : [],
        },
      }))
    } catch (error) {
      setCandidateStates((states) => ({
        ...states,
        [runId]: {
          expanded: true,
          loading: false,
          error: error instanceof Error ? error.message : "候选列表加载失败",
          data: null,
        },
      }))
    }
  }, [candidateStates])

  useEffect(() => {
    void loadRunHistory()
    void loadModels()
  }, [loadModels, loadRunHistory])

  /**
   * 手动执行 AI 日报生成。
   * regenerate=true 时表示强制重生成当日内容，而不是命中“已存在则跳过”的幂等逻辑。
   */
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
        throw new Error(getApiErrorMessage(data, "AI 日报生成失败"))
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
        description="聚合多源候选，筛选高价值 AI 新闻，生成中文日报草稿，并通过 AI 审稿后自动上线。"
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

      <WorkspacePanel title="候选策略" description="多源抓取 + 去重评分 + AI 审稿自动上线" className="border border-[var(--border)]">
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
            <Select
              value={selectedModelId || unavailableModelValue}
              onValueChange={(value) => value !== unavailableModelValue && setSelectedModelId(value)}
              disabled={modelsLoading || readyModels.length === 0}
            >
              <SelectTrigger className={adminSelectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={adminSelectContentClassName}>
                {modelsLoading ? <SelectItem value={unavailableModelValue} disabled>模型加载中</SelectItem> : null}
                {!modelsLoading && readyModels.length === 0 ? <SelectItem value={unavailableModelValue} disabled>暂无可用模型</SelectItem> : null}
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} disabled={model.status !== "ready" || !model.capabilities.includes("post-summary")}>
                    {model.name} · {model.model} · {modelStatusLabel(model)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
            <p>流程：抓取 RSS/Atom/HN/GitHub → URL 去重 → AI 评分筛选 → 生成 Markdown 日报 → AI 审稿 → 达标自动发布。</p>
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
              <span className="text-sm text-[var(--muted)]">
                {result.metrics
                  ? `原始 ${result.metrics.rawCandidateCount} · 去重 ${result.metrics.dedupedCandidateCount} · 入选 ${result.metrics.selectedCandidateCount}`
                  : `候选新闻 ${result.sourceCount ?? 0} 条`}
              </span>
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
            const candidates = candidateStates[run.id]
            return (
              <div key={run.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <span className="text-sm text-[var(--muted)]">{runTriggerLabel(run.trigger)}</span>
                  <span className="text-sm text-[var(--muted)]">{run.runDate.slice(0, 10)}</span>
                  <span className="text-sm text-[var(--muted)]">{runCandidateFunnel(run)}</span>
                  {run.failureCount ? <span className="text-sm text-[var(--muted)]">失败 {run.failureCount} 个</span> : null}
                  {typeof run.qualityScore === "number" ? <span className="text-sm text-[var(--muted)]">质量 {run.qualityScore} 分</span> : null}
                  {run.durationMs ? <span className="text-sm text-[var(--muted)]">{Math.round(run.durationMs / 1000)} 秒</span> : null}
                  <Button type="button" variant="outline" onClick={() => void toggleRunCandidates(run.id)}>
                    {candidates?.expanded ? "收起候选" : "展开候选"}
                  </Button>
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

                {candidates?.expanded ? (
                  <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                    {candidates.loading ? <p className="text-sm text-[var(--muted)]">候选加载中...</p> : null}
                    {candidates.error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{candidates.error}</p> : null}
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
    </div>
  )
}
