"use client";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import type { PublicAiModelOption } from "@/lib/ai-models";

const unavailableModelValue = "__unavailable_model__";
const adminSelectTriggerClassName = "w-full rounded-2xl border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] shadow-none focus:border-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-60";
const adminSelectContentClassName = "rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

function modelStatusLabel(model: PublicAiModelOption) {
  if (model.status === "ready") return model.defaultFor.includes("post-summary") ? "默认" : "可用"
  if (model.status === "disabled") return "已停用"
  return "缺少密钥"
}

type AiNewsRunControlsPanelProps = {
  date: string;
  onDateChange: (value: string) => void;
  selectedModelId: string;
  onModelChange: (value: string) => void;
  models: PublicAiModelOption[];
  modelsLoading: boolean;
  modelsError: unknown;
  readyModels: PublicAiModelOption[];
  selectedModel: PublicAiModelOption | null;
  sourceMode: "selected" | "default";
  selectedSourceCount: number;
};

/**
 * 「候选策略」控制面板：生成日期、生成模型与流水线说明。
 * 纯展示组件，所有变更经回调上抛。
 */
export function AiNewsRunControlsPanel({
  date,
  onDateChange,
  selectedModelId,
  onModelChange,
  models,
  modelsLoading,
  modelsError,
  readyModels,
  selectedModel,
  sourceMode,
  selectedSourceCount,
}: AiNewsRunControlsPanelProps) {
  return (
    <WorkspacePanel title="候选策略" description="多源抓取 + 去重评分 + 内容增强后直接上线" className="border border-[var(--border)]">
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(280px,360px)_1fr]">
        <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
          生成日期
          <input
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"
          />
        </label>
        <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
          生成模型
          <Select
            value={selectedModelId || unavailableModelValue}
            onValueChange={(value) => value !== unavailableModelValue && onModelChange(value)}
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
          <p>流程：抓取 RSS/Atom/HN/GitHub → URL 去重 → AI 评分筛选 → 生成 Markdown 日报 → 内容增强 → 直接发布。</p>
          <p className="mt-2">同一天使用固定 slug，重复触发不会重复创建文章。</p>
          <p className="mt-2">重新生成会覆盖同日已存在日报内容，并保留原文章链接。</p>
          <p className="mt-2">
            来源范围：{sourceMode === "selected" ? `本次选中 ${selectedSourceCount} 个来源` : "默认启用来源"}。
          </p>
          {selectedModel ? (
            <p className="mt-2">
              当前模型：{selectedModel.name}（{selectedModel.model}）。
            </p>
          ) : null}
          {modelsError ? <p className="mt-2 text-[var(--danger-foreground)]">{String(modelsError)}</p> : null}
        </div>
      </div>
    </WorkspacePanel>
  );
}
