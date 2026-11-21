"use client";

/**
 * 后台 AI 日报控制台数据层 hook。
 *
 * 职责：
 * - 运行日期/模型选择/运行中/最近结果/候选展开等状态
 * - 运行历史、活跃 runId 状态轮询与模型列表的 SWR 拉取
 * - 手动触发/重生成日报（支持 202 Accepted 异步 runId 轮询与同步响应兼容）、候选明细懒加载
 * 展示侧由 AiNewsRunControlsPanel / AiNewsRunResultPanel / AiNewsRunHistoryPanel 消费。
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { useAiNewsSources } from "@/components/admin/ai-news/hooks/useAiNewsSources";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";
import type { PublicAiModelOption } from "@/lib/ai-models";

export type RunHistoryItem = {
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
  postTitle?: string | null
  postSlug?: string | null
  published: boolean
  reviewScore?: number | null
  createdAt: string
  durationMs?: number | null
  sourceFailureJson?: Array<{ sourceId?: string; message: string }> | null
  sourceSnapshotJson?: Array<{ id: string; name: string; type: string; defaultEnabled?: boolean }> | null
}

export type RunCandidateItem = {
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

export type CandidateState = {
  expanded: boolean
  loading: boolean
  error: string | null
  data: RunCandidateItem[] | null
}

export type RunResult = {
  operation: "created" | "skipped" | "regenerated"
  reason?: string
  published: boolean
  sourceCount: number
  post?: { id: string; title: string; slug: string; published: boolean }
  generatedBy?: { id: string; name: string; model: string }
  failures?: Array<{ sourceId: string; message: string }>
  metrics?: {
    rawCandidateCount: number
    dedupedCandidateCount: number
    scoredCandidateCount: number
    selectedCandidateCount: number
    qualityScore?: number | null
    citationCoverage?: number | null
    generationMode?: string | null
    configuredSourceCount?: number | null
  }
  run?: { id: string; status: RunHistoryItem["status"] }
}

type QueuedRunPayload = {
  operation: "queued" | "already-running"
  runId: string
  date: string
  run: { id: string; status: "RUNNING" }
}

type RunTriggerResponsePayload = RunResult | QueuedRunPayload

function isQueuedRunPayload(payload: RunTriggerResponsePayload | undefined): payload is QueuedRunPayload {
  return Boolean(
    payload &&
      (payload.operation === "queued" || payload.operation === "already-running") &&
      typeof (payload as QueuedRunPayload).runId === "string",
  )
}

function buildRunResultFromHistory(
  run: RunHistoryItem,
  regenerate: boolean,
  selectedModel: PublicAiModelOption | null,
): RunResult {
  const operation: RunResult["operation"] =
    run.status === "SKIPPED" ? "skipped" : regenerate ? "regenerated" : "created"
  const configuredSourceCount = Array.isArray(run.sourceSnapshotJson) ? run.sourceSnapshotJson.length : null
  const failures = Array.isArray(run.sourceFailureJson)
    ? run.sourceFailureJson.map((failure, index) => ({
        sourceId: failure.sourceId ?? `source-${index + 1}`,
        message: failure.message,
      }))
    : []

  return {
    operation,
    reason: run.status === "SKIPPED" ? (run.error ?? (run.published ? "今日 AI 日报已存在" : "今日 AI 日报草稿待人工审核")) : undefined,
    published: run.published,
    sourceCount: run.sourceCount,
    ...(run.postId && run.postSlug
      ? {
          post: {
            id: run.postId,
            title: run.postTitle ?? `${run.runDate.slice(0, 10)} AI 日报`,
            slug: run.postSlug,
            published: run.published,
          },
        }
      : {}),
    ...(selectedModel && operation !== "skipped"
      ? {
          generatedBy: {
            id: selectedModel.id,
            name: selectedModel.name,
            model: selectedModel.model,
          },
        }
      : {}),
    failures,
    ...(typeof run.rawCandidateCount === "number"
      ? {
          metrics: {
            rawCandidateCount: run.rawCandidateCount,
            dedupedCandidateCount: run.dedupedCandidateCount ?? run.rawCandidateCount,
            scoredCandidateCount: run.scoredCandidateCount ?? run.rawCandidateCount,
            selectedCandidateCount: run.selectedCandidateCount ?? 0,
            qualityScore: run.qualityScore ?? null,
            citationCoverage: run.citationCoverage ?? null,
            generationMode: run.generationMode ?? null,
            configuredSourceCount,
          },
        }
      : {}),
    run: { id: run.id, status: run.status },
  }
}

function notifyCompletedRunToast(result: RunResult) {
  if (result.operation === "skipped") {
    toast.message(result.published ? "今日 AI 日报已存在并已上线" : "今日 AI 日报草稿待人工审核")
    return
  }
  if (result.operation === "regenerated") {
    toast.success(result.published ? "AI 日报已重新生成并上线" : "AI 日报草稿已重新生成")
    return
  }
  toast.success(result.published ? "AI 日报已生成并上线" : "AI 日报草稿已生成，待人工审核")
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultNewsModel(models: PublicAiModelOption[]) {
  return (
    models.find((model) => model.status === "ready" && model.defaultFor.includes("post-summary")) ??
    models.find((model) => model.status === "ready" && model.capabilities.includes("post-summary")) ??
    null
  )
}

export function useAdminAiNews() {
  const [date, setDate] = useState(todayInputValue())
  const [selectedModelId, setSelectedModelId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [activeRunState, setActiveRunState] = useState<{
    runId: string
    regenerate: boolean
    modelSnapshot: PublicAiModelOption | null
  } | null>(null)
  const [result, setResult] = useState<RunResult | null>(null)
  const [candidateStates, setCandidateStates] = useState<Record<string, CandidateState>>({})
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const aiNewsSources = useAiNewsSources()

  const {
    data: runsResponse,
    isLoading: runsLoading,
    error: runsError,
    mutate: mutateRuns,
  } = useSWR<{ success?: boolean; data?: RunHistoryItem[] }>("/api/admin/ai-news/run", apiFetcher, {
    revalidateOnMount: true,
    refreshInterval: (latestData) => {
      const list = Array.isArray(latestData?.data) ? latestData.data : []
      return activeRunState !== null || list.some((item) => item.status === "RUNNING") ? 2000 : 0
    },
    onError: (error, key) => handleGlobalSwrError(error, key),
  })

  const {
    data: modelsResponse,
    isLoading: modelsLoading,
    error: modelsError,
  } = useSWR<{ success?: boolean; data?: PublicAiModelOption[] }>("/api/admin/ai/models", apiFetcher, {
    revalidateOnMount: true,
  })

  const runs = useMemo(() => (Array.isArray(runsResponse?.data) ? runsResponse.data : []), [runsResponse?.data])
  const models = useMemo(() => (Array.isArray(modelsResponse?.data) ? modelsResponse.data : []), [modelsResponse?.data])

  const defaultNewsModelId = selectedModelId ? "" : getDefaultNewsModel(models)?.id ?? ""
  if (!selectedModelId && defaultNewsModelId) {
    setSelectedModelId(defaultNewsModelId)
  }

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  const readyModels = useMemo(
    () => models.filter((model) => model.status === "ready" && model.capabilities.includes("post-summary")),
    [models],
  )

  useSWR<{ success?: boolean; data?: RunHistoryItem }>(
    activeRunState ? `/api/admin/ai-news/run?runId=${encodeURIComponent(activeRunState.runId)}` : null,
    apiFetcher,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      refreshInterval: 2000,
      onSuccess: (response) => {
        const polledRun = response?.data
        if (!polledRun || !activeRunState || polledRun.id !== activeRunState.runId) {
          return
        }
        if (polledRun.status === "RUNNING") {
          return
        }

        const currentState = activeRunState
        setActiveRunState(null)
        void mutateRuns()

        if (polledRun.status === "FAILED") {
          toast.error(polledRun.error || "AI 日报生成失败")
          return
        }

        const completedResult = buildRunResultFromHistory(
          polledRun,
          currentState.regenerate,
          currentState.modelSnapshot,
        )
        setResult(completedResult)
        notifyCompletedRunToast(completedResult)
      },
      onError: (error, key) => handleGlobalSwrError(error, key),
    },
  )

  const running = submitting || activeRunState !== null

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
      const data = await apiFetcher<{ success?: boolean; data?: RunCandidateItem[] }>(
        `/api/admin/ai-news/candidates?runId=${encodeURIComponent(runId)}`,
      )

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
          error: toErrorMessage(error, "候选列表加载失败"),
          data: null,
        },
      }))
    }
  }, [candidateStates])

  async function runNewsGeneration(regenerate = false): Promise<boolean> {
    if (!selectedModelId) {
      toast.error("请选择可用模型")
      return false
    }
    if (aiNewsSources.sourceMode === "selected" && aiNewsSources.selectedSourceIds.length === 0) {
      toast.error("至少选择一个来源")
      return false
    }

    setSubmitting(true)
    try {
      const sourcePayload = aiNewsSources.sourceMode === "selected"
        ? { sourceMode: "selected", sourceIds: aiNewsSources.selectedSourceIds }
        : {}
      const data = await apiMutate<{ success?: boolean; data?: RunTriggerResponsePayload }>("/api/admin/ai-news/run", {
        method: "POST",
        body: JSON.stringify({ date, modelId: selectedModelId, ...(regenerate ? { regenerate: true } : {}), ...sourcePayload }),
      })

      if (isQueuedRunPayload(data.data)) {
        setActiveRunState({
          runId: data.data.runId,
          regenerate,
          modelSnapshot: selectedModel,
        })
        void mutateRuns()
        toast.message("AI 日报任务已启动，正在后台生成...")
        return true
      }

      const directResult = (data.data as RunResult | undefined) ?? null
      setResult(directResult)
      void mutateRuns()
      if (directResult) {
        notifyCompletedRunToast(directResult)
      }
      return true
    } catch (error) {
      toast.error(toErrorMessage(error, "AI 日报生成失败"))
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return {
    aiNewsSources,
    candidateStates,
    date,
    models,
    modelsError,
    modelsLoading,
    readyModels,
    regenerateConfirmOpen,
    result,
    running,
    runs,
    runsError,
    runsLoading,
    selectedModel,
    selectedModelId,
    setDate,
    setRegenerateConfirmOpen,
    setSelectedModelId,
    toggleRunCandidates,
    runNewsGeneration,
  };
}
