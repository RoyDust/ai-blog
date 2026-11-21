"use client";

/**
 * 后台 AI 日报控制台数据层 hook。
 *
 * 职责：
 * - 运行日期/模型选择/运行中/最近结果/候选展开等状态
 * - 运行历史与模型列表的 SWR 拉取
 * - 手动触发/重生成日报、候选明细懒加载
 * 展示侧由 AiNewsRunControlsPanel / AiNewsRunResultPanel / AiNewsRunHistoryPanel 消费。
 */

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { useAiNewsSources } from "@/components/admin/ai-news/hooks/useAiNewsSources";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";
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
  postSlug?: string | null
  published: boolean
  reviewScore?: number | null
  createdAt: string
  durationMs?: number | null
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
  const [running, setRunning] = useState(false)
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
  });

  const {
    data: modelsResponse,
    isLoading: modelsLoading,
    error: modelsError,
  } = useSWR<{ success?: boolean; data?: PublicAiModelOption[] }>("/api/admin/ai/models", apiFetcher, {
    revalidateOnMount: true,
  });

  const runs = useMemo(() => (Array.isArray(runsResponse?.data) ? runsResponse.data : []), [runsResponse?.data]);
  const models = useMemo(() => (Array.isArray(modelsResponse?.data) ? modelsResponse.data : []), [modelsResponse?.data]);

  // 自动选择默认模型（渲染期条件调整）
  if (!selectedModelId && models.length > 0) {
    setSelectedModelId(getDefaultNewsModel(models)?.id ?? "");
  }

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  )

  const readyModels = useMemo(
    () => models.filter((model) => model.status === "ready" && model.capabilities.includes("post-summary")),
    [models],
  )

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

  /**
   * 手动执行 AI 日报生成。
   * regenerate=true 时表示强制重生成当日内容，而不是命中"已存在则跳过"的幂等逻辑。
   */
  async function runNewsGeneration(regenerate = false): Promise<boolean> {
    if (!selectedModelId) {
      toast.error("请选择可用模型")
      return false
    }
    if (aiNewsSources.sourceMode === "selected" && aiNewsSources.selectedSourceIds.length === 0) {
      toast.error("至少选择一个来源")
      return false
    }

    setRunning(true)
    try {
      const sourcePayload = aiNewsSources.sourceMode === "selected"
        ? { sourceMode: "selected", sourceIds: aiNewsSources.selectedSourceIds }
        : {}
      const data = await apiMutate<{ success?: boolean; data?: RunResult }>("/api/admin/ai-news/run", {
        method: "POST",
        body: JSON.stringify({ date, modelId: selectedModelId, ...(regenerate ? { regenerate: true } : {}), ...sourcePayload }),
      })

      setResult(data.data ?? null)
      void mutateRuns()
      if (data.data?.operation === "skipped") {
        toast.message("今日 AI 日报已存在并已上线")
      } else if (data.data?.operation === "regenerated") {
        toast.success("AI 日报已重新生成并上线")
      } else {
        toast.success("AI 日报已生成并上线")
      }
      return true
    } catch (error) {
      toast.error(toErrorMessage(error, "AI 日报生成失败"))
      return false
    } finally {
      setRunning(false)
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
