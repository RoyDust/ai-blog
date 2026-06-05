"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { readApiJson } from "@/lib/admin-api-client"

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
  const [sources, setSources] = useState<PublicAiNewsSource[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [sourceMode, setSourceMode] = useState<SourceMode>("default")
  const [query, setQueryValue] = useState("")
  const [category, setCategoryValue] = useState("all")
  const [pagination, setPagination] = useState<AiNewsSourcePagination>(defaultPagination)
  const [summary, setSummary] = useState<AiNewsSourceSummary>(defaultSummary)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [testResults, setTestResults] = useState<Record<string, AiNewsSourceTestResult>>({})

  const selectedSources = useMemo(
    () => sources.filter((source) => selectedSourceIds.includes(source.id)),
    [selectedSourceIds, sources],
  )

  const clearFeedback = () => {
    setMessage("")
    setError("")
  }

  const loadSources = useCallback(async () => {
    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      })
      if (query.trim()) params.set("q", query.trim())
      if (category !== "all") params.set("category", category)

      const data = await readApiJson<{
        data?: PublicAiNewsSource[]
        pagination?: AiNewsSourcePagination
        summary?: AiNewsSourceSummary
      }>(await fetch(`/api/admin/ai-news/sources?${params.toString()}`), "来源加载失败")
      const nextSources = Array.isArray(data.data) ? data.data : []
      const nextPagination = data.pagination ?? { ...defaultPagination, limit: pagination.limit }
      const nextSummary = data.summary ?? defaultSummary
      setSources(nextSources)
      setPagination(nextPagination)
      setSummary(nextSummary)
      setSelectedSourceIds((current) => {
        return current.length > 0 ? current : nextSummary.enabledSourceIds
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "来源加载失败")
      setPagination((current) => ({ ...defaultPagination, limit: current.limit }))
    } finally {
      setLoading(false)
    }
  }, [category, pagination.limit, pagination.page, query])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

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
      const response = form.id
        ? await fetch(`/api/admin/ai-news/sources/${encodeURIComponent(form.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sourcePayload(form)),
          })
        : await fetch("/api/admin/ai-news/sources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sourcePayload(form)),
          })

      await readApiJson(response, "来源保存失败")
      await loadSources()
      setMessage(form.id ? "来源已更新。" : "来源已创建。")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "来源保存失败")
      throw saveError
    } finally {
      setSaving(false)
    }
  }

  const toggleSourceEnabled = async (source: PublicAiNewsSource) => {
    clearFeedback()

    try {
      await readApiJson(
        await fetch(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: !source.enabled }),
        }),
        "来源启停失败",
      )
      if (source.enabled) {
        setSelectedSourceIds((current) => current.filter((id) => id !== source.id))
      }
      await loadSources()
      setMessage(!source.enabled ? "来源已启用。" : "来源已停用。")
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "来源启停失败")
    }
  }

  const deleteSource = async (source: PublicAiNewsSource) => {
    if (!source.deletable) return
    if (!window.confirm(`删除来源「${source.name}」？历史候选会保留来源名称快照。`)) return

    setDeletingId(source.id)
    clearFeedback()

    try {
      await readApiJson(await fetch(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, { method: "DELETE" }), "来源删除失败")
      setSelectedSourceIds((current) => current.filter((id) => id !== source.id))
      await loadSources()
      setMessage("来源已删除。")
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "来源删除失败")
    } finally {
      setDeletingId(null)
    }
  }

  const testSource = async (source: PublicAiNewsSource) => {
    setTestingId(source.id)
    clearFeedback()

    try {
      const data = await readApiJson<{ data?: AiNewsSourceTestResult }>(
        await fetch(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}/test`, { method: "POST" }),
        "来源测试失败",
      )
      if (data.data) {
        setTestResults((current) => ({ ...current, [source.id]: data.data as AiNewsSourceTestResult }))
        setMessage(data.data.message)
      }
      await loadSources()
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "来源测试失败")
      await loadSources().catch(() => undefined)
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
          fetch(`/api/admin/ai-news/sources/${encodeURIComponent(source.id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: false }),
          }).then((response) => readApiJson(response, "批量停用失败")),
        ),
      )
      await loadSources()
      setMessage("已停用有健康提醒的来源。")
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "批量停用失败")
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
    loadSources,
    saveSource,
    toggleSourceEnabled,
    deleteSource,
    testSource,
    disableProblemSources,
  }
}
