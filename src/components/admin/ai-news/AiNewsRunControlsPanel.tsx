"use client";

import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import type { PublicAiModelOption } from "@/lib/ai-models";

const unavailableModelValue = "__unavailable_model__";
const fieldLabelClassName = "text-[0.8125rem] leading-[1.4] font-bold text-[var(--foreground)]";

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
    <section aria-labelledby="ai-news-strategy-title" data-slot="ai-news-strategy">
      <AdminSectionHeader id="ai-news-strategy-title" title="候选策略" description="多源抓取 + 去重评分 + 内容增强后直接上线" />
      <div className="grid gap-x-6 gap-y-4 pt-4 xl:grid-cols-[200px_minmax(260px,300px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-1.5">
          <label className={fieldLabelClassName} htmlFor="ai-news-date">
            生成日期
          </label>
          <input
            id="ai-news-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
            className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent px-2.5 font-mono text-sm text-[var(--foreground)] transition-[border-color] duration-150 hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span id="ai-news-model-label" className={fieldLabelClassName}>
            生成模型
          </span>
          <Select
            value={selectedModelId || unavailableModelValue}
            onValueChange={(value) => value !== unavailableModelValue && onModelChange(value)}
            disabled={modelsLoading || readyModels.length === 0}
          >
            <SelectTrigger aria-labelledby="ai-news-model-label" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelsLoading ? <SelectItem value={unavailableModelValue} disabled>模型加载中</SelectItem> : null}
              {!modelsLoading && readyModels.length === 0 ? <SelectItem value={unavailableModelValue} disabled>暂无可用模型</SelectItem> : null}
              {models.map((model) => (
                <SelectItem key={model.id} value={model.id} disabled={model.status !== "ready" || !model.capabilities.includes("post-summary")}>
                  {model.name} · {model.model} · {modelStatusLabel(model)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border-l border-[var(--border)] pl-4 text-[0.8125rem] leading-[1.75] text-[var(--text-body)]">
          <p>流程：抓取 RSS / Atom / HN / GitHub → URL 去重 → AI 评分筛选 → 生成 Markdown 日报 → 内容增强 → 直接发布。</p>
          <p>同一天使用固定 slug，重复触发不会重复创建文章；重新生成会覆盖同日已存在日报内容，并保留原文章链接。</p>
          <p className="text-[var(--text-muted)]">
            来源范围：
            {sourceMode === "selected" ? (
              <>
                本次选中 <span className="font-mono font-bold text-[var(--foreground)]">{selectedSourceCount}</span> 个来源
              </>
            ) : (
              "默认启用来源"
            )}
            {selectedModel ? ` · 当前模型：${selectedModel.name}（${selectedModel.model}）` : ""}。
          </p>
          {modelsError ? <p className="text-[var(--danger-foreground)]" role="alert">{String(modelsError)}</p> : null}
        </div>
      </div>
    </section>
  );
}
