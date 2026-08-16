"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"

import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api"

import type { AiNewsSourceFormState, AiNewsSourcePagination, AiNewsSourceSummary, AiNewsSourceTestResult, PublicAiNewsSource } from "../types"

type SourceMode = "default" | "selected"

const defaultPagination: AiNewsSourcePagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
}

const defaultSummary: AiNewsSourceSummary = {
  enabledCount: 0,
  enabledSourceIds: [],
}

function sourcePayload(form: AiNewsSourceFormState) {
  const settings =
    form.type === "HACKERNEWS"
      ? {
          commentLimit: form.commentLimit ? Number(form.commentLimit) : undefined,
          commentTextMaxLength: form.commentTextMaxLength ? Number(form.commentTextMaxLength) : undefined,
        }
      : undefined

  return {
    type: form.type,
    name: form.name,
    url: form.url,
    homepage: form.homepage || undefined,
    category: form.category || undefined,
    enabled: form.enabled,
    weight: Number(form.weight || 50),
    minScore: form.minScore ? Number(form.minScore) : undefined,
    fetchLimit: form.fetchLimit ? Number(form.fetchLimit) : undefined,
    ...(settings ? { settings } : {}),
  }
}

export function useAiNewsSources() {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [sourceMode, setSourceMode] = useState<SourceMode>("default")
  const [query, setQueryValue] = useState("")
  const [category, setCategoryValue] = useState("all")
  const [pagination, setPagination] = useState<AiNewsSourcePagination>(defaultPagination)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [testResults, setTestResults] = useState<Record<string, AiNewsSourceTestResult>>({})

  const sourcesUrl = useMemo(() => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      limit: String(pagination.limit),
    })
    if (query.trim()) params.set("q", query.trim())
    if (category !== "all") params.set("category", category)
    return `/api/admin/ai-news/sources?${params.toString()}`
  }, [category, pagination.limit, pagination.page, query])

  const {
    data: sourcesResponse,
    isLoading,
    mutate: mutateSources,
  } = useSWR<{
    data?: PublicAiNewsSource[]
    pagination?: AiNewsSourcePagination
    summary?: AiNewsSourceSummary
  }>(sourcesUrl, apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key)
      setError(toErrorMessage(swrError, "来源加载失败"))
    },
  })

  const sources = useMemo(() => (Array.isArray(sourcesResponse?.data) ? sourcesResponse.data : []), [sourcesResponse?.data])
  const summary = sourcesResponse?.summary ?? defaultSummary
  const loading = isLoading

  // 首次加载后默认选中启用的来源（渲染期条件调整，与旧实现一致：空选择时回落到启用集）
  if (selectedSourceIds.length === 0 && summary.enabledSourceIds.length > 0) {
    setSelectedSourceIds(summary.enabledSourceIds)
  }

  const selectedSources = useMemo(
    () => sources.filter((source) => selectedSourceIds.includes(source.id)),
    [selectedSourceIds, sources],
  )

  const clearFeedback = () => {
    setMessage("")
    setError("")
  }

  const toggleSourceSelection = (sourceId: string) => {
    setSelectedSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId],
    )
  }

  const selectEnabledSources = () => {
    setSelectedSourceIds(summary.enabledSourceIds)
  }

  const setQuery = (value: string) => {
    setQueryValue(value)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const setCategory = (value: string) => {
    setCategoryValue(value)
    setPagination((current) => ({ ...current, page: 1 }))
  }

  const setPage = (page: number) => {
    setPagination((current) => ({ ...current, page }))
  }

  const setPageSize = (limit: number) => {
    setPagination((current) => ({ ...current, page: 1, limit }))
  }

  const saveSource = async (form: AiNewsSourceFormState) => {
    setSaving(true)
    clearFeedback()

    try {
      await apiMutate(
        form.id ? `/api/admin/ai-news/sources/${encodeURIComponent(form.id)}` : "/api/admin/ai-news/sources",
        {
          method: form.id ? "PATCH" : "POST",
          body: JSON.stringify(sourcePayload(form)),
        },
      )
      void mutateSources()
      setMessage(form.id ? "来源已更新。" : "来源已创建。")
    } catch (saveError) {
      setError(toErrorMessage(saveError, "来源保存失败"))
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  const toggleSourceEnabled = async (source: PublicAiNewsSource) => {
    clearFeedback()

    try {
      await apiMutate(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !source.enabled }),
      })
      if (source.enabled) {
        setSelectedSourceIds((current) => current.filter((id) => id !== source.id))
      }
      void mutateSources()
      setMessage(!source.enabled ? "来源已启用。" : "来源已停用。")
    } catch (toggleError) {
      setError(toErrorMessage(toggleError, "来源启停失败"))
    }
  }

  const deleteSource = async (source: PublicAiNewsSource) => {
    if (!source.deletable) return
    if (!window.confirm(`删除来源「${source.name}」？历史候选会保留来源名称快照。`)) return

    setDeletingId(source.id)
    clearFeedback()

    try {
      await apiMutate(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, { method: "DELETE" })
      setSelectedSourceIds((current) => current.filter((id) => id !== source.id))
      void mutateSources()
      setMessage("来源已删除。")
    } catch (deleteError) {
      setError(toErrorMessage(deleteError, "来源删除失败"))
    } finally {
      setDeletingId(null)
    }
  }

  const testSource = async (source: PublicAiNewsSource) => {
    setTestingId(source.id)
    clearFeedback()

    try {
      const data = await apiMutate<{ data?: AiNewsSourceTestResult }>(
        `/api/admin/ai-news/sources/${encodeURIComponent(source.id)}/test`,
        { method: "POST" },
      )
      if (data.data) {
        setTestResults((current) => ({ ...current, [source.id]: data.data as AiNewsSourceTestResult }))
        setMessage(data.data.message)
      }
      void mutateSources()
    } catch (testError) {
      setError(toErrorMessage(testError, "来源测试失败"))
      void mutateSources()
    } finally {
      setTestingId(null)
    }
  }

  const disableProblemSources = async () => {
    const problemSources = sources.filter((source) => source.enabled && source.healthWarnings.length > 0)
    if (problemSources.length === 0) return
    if (!window.confirm(`停用 ${problemSources.length} 个有健康提醒的来源？`)) return

    clearFeedback()
    setSaving(true)
    try {
      await Promise.all(
        problemSources.map((source) =>
          apiMutate(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, {
            method: "PATCH",
            body: JSON.stringify({ enabled: false }),
          }),
        ),
      )
      void mutateSources()
      setMessage("已停用有健康提醒的来源。")
    } catch (batchError) {
      setError(toErrorMessage(batchError, "批量停用失败"))
    } finally {
      setSaving(false)
    }
  }

  return {
    sources,
    selectedSources,
    selectedSourceIds,
    sourceMode,
    query,
    category,
    pagination,
    summary,
    loading,
    saving,
    testingId,
    deletingId,
    message,
    error,
    testResults,
    setSourceMode,
    setSelectedSourceIds,
    setQuery,
    setCategory,
    setPage,
    setPageSize,
    toggleSourceSelection,
    selectEnabledSources,
    loadSources: () => {
      void mutateSources();
    },
    saveSource,
    toggleSourceEnabled,
    deleteSource,
    testSource,
    disableProblemSources,
  }
}
