"use client"

/**
 * 后台 AI 日报控制台。
 *
 * 结构（2026-08 拆分）：
 * - useAdminAiNews：状态、SWR 拉取与手动触发动作（数据层）
 * - AiNewsRunControlsPanel：「候选策略」控制面板
 * - AiNewsRunResultPanel：「最近一次运行」结果面板
 * - AiNewsRunHistoryPanel：「运行记录」列表与候选明细面板
 * - AiNewsSourcePanel：来源管理（既有组件）
 * 页面只保留头部动作、确认弹窗与面板装配。
 */

import { PageHeader } from "@/components/admin/primitives/PageHeader"
import { Button } from "@/components/admin/ui"
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog"
import { AiNewsSourcePanel } from "@/components/admin/ai-news/AiNewsSourcePanel"
import { AiNewsRunControlsPanel } from "@/components/admin/ai-news/AiNewsRunControlsPanel"
import { AiNewsRunHistoryPanel } from "@/components/admin/ai-news/AiNewsRunHistoryPanel"
import { AiNewsRunResultPanel } from "@/components/admin/ai-news/AiNewsRunResultPanel"
import { useAdminAiNews } from "@/components/admin/ai-news/hooks/useAdminAiNews"

export default function AdminAiNewsPage() {
  const {
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
  } = useAdminAiNews()

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI News"
        title="每日 AI 新闻推送"
        description="聚合多源候选，筛选高价值 AI 新闻，生成并增强中文日报后直接上线。"
        action={
          <>
            <Button type="button" disabled={running || !selectedModelId} onClick={() => void runNewsGeneration()}>
              {running ? "生成中..." : "生成今日 AI 日报"}
            </Button>
            <Button type="button" variant="outline" disabled={running || !selectedModelId} onClick={() => setRegenerateConfirmOpen(true)}>
              重新生成今日日报
            </Button>
          </>
        }
      />

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认重新生成"
        description="重新生成会覆盖当日已生成内容，并保留原文章链接。"
        onConfirm={async () => {
          const ok = await runNewsGeneration(true)
          // 仅成功后关闭：失败保留弹窗可原地重试
          if (ok) setRegenerateConfirmOpen(false)
        }}
        onOpenChange={setRegenerateConfirmOpen}
        open={regenerateConfirmOpen}
        submitting={running}
        title="重新生成今日 AI 日报"
        tone="danger"
      />

      <AiNewsRunControlsPanel
        date={date}
        onDateChange={setDate}
        selectedModelId={selectedModelId}
        onModelChange={setSelectedModelId}
        models={models}
        modelsLoading={modelsLoading}
        modelsError={modelsError}
        readyModels={readyModels}
        selectedModel={selectedModel}
        sourceMode={aiNewsSources.sourceMode}
        selectedSourceCount={aiNewsSources.selectedSourceIds.length}
      />

      <AiNewsSourcePanel
        sources={aiNewsSources.sources}
        selectedSourceIds={aiNewsSources.selectedSourceIds}
        sourceMode={aiNewsSources.sourceMode}
        query={aiNewsSources.query}
        category={aiNewsSources.category}
        pagination={aiNewsSources.pagination}
        summary={aiNewsSources.summary}
        loading={aiNewsSources.loading}
        saving={aiNewsSources.saving}
        testingId={aiNewsSources.testingId}
        deletingId={aiNewsSources.deletingId}
        message={aiNewsSources.message}
        error={aiNewsSources.error}
        testResults={aiNewsSources.testResults}
        onSourceModeChange={aiNewsSources.setSourceMode}
        onQueryChange={aiNewsSources.setQuery}
        onCategoryChange={aiNewsSources.setCategory}
        onPageChange={aiNewsSources.setPage}
        onPageSizeChange={aiNewsSources.setPageSize}
        onToggleSourceSelection={aiNewsSources.toggleSourceSelection}
        onSelectEnabledSources={aiNewsSources.selectEnabledSources}
        onReload={() => void aiNewsSources.loadSources()}
        onSaveSource={aiNewsSources.saveSource}
        onToggleSourceEnabled={(source) => void aiNewsSources.toggleSourceEnabled(source)}
        onDeleteSource={(source) => void aiNewsSources.deleteSource(source)}
        onTestSource={(source) => void aiNewsSources.testSource(source)}
        onDisableProblemSources={() => void aiNewsSources.disableProblemSources()}
      />

      {result ? <AiNewsRunResultPanel result={result} /> : null}

      <AiNewsRunHistoryPanel
        runs={runs}
        runsLoading={runsLoading}
        runsError={runsError}
        candidateStates={candidateStates}
        onToggleCandidates={(runId) => void toggleRunCandidates(runId)}
      />
    </div>
  )
}
