"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button, Modal } from "@/components/ui";

type AiBatchAction = "summary" | "seo-description" | "tags" | "category";
type AiBatchMode = "missing-only" | "overwrite" | "suggest-only";

const actionOptions: Array<{ value: AiBatchAction; label: string; hint: string; autoApply: boolean }> = [
  { value: "summary", label: "摘要", hint: "可自动写入空摘要", autoApply: true },
  { value: "seo-description", label: "SEO 描述", hint: "可自动写入空 SEO 描述", autoApply: true },
  { value: "tags", label: "标签建议", hint: "只保存建议，人工确认后应用", autoApply: false },
  { value: "category", label: "分类建议", hint: "只保存建议，人工确认后应用", autoApply: false },
];

const modeOptions: Array<{ value: AiBatchMode; label: string; hint: string }> = [
  { value: "missing-only", label: "只补缺失", hint: "跳过已有对应字段的文章" },
  { value: "suggest-only", label: "仅生成建议", hint: "不覆盖当前字段" },
  { value: "overwrite", label: "重新生成", hint: "为所选文章重新生成建议" },
];

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

export function BulkAiCompletionDialog({
  open,
  selectedIds,
  onClose,
  onStarted,
}: {
  open: boolean;
  selectedIds: string[];
  onClose: () => void;
  onStarted?: (taskId: string) => void;
}) {
  const [actions, setActions] = useState<AiBatchAction[]>(["summary", "seo-description"]);
  const [mode, setMode] = useState<AiBatchMode>("missing-only");
  const [applySafeFields, setApplySafeFields] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const safeApplyDisabled = useMemo(() => !actions.some((action) => action === "summary" || action === "seo-description"), [actions]);

  function toggleAction(action: AiBatchAction) {
    setActions((current) => (current.includes(action) ? current.filter((item) => item !== action) : [...current, action]));
  }

  async function startBatch() {
    if (selectedIds.length === 0 || actions.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setTaskId(null);

    try {
      const response = await fetch("/api/admin/ai/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postIds: selectedIds,
          actions,
          mode,
          apply: applySafeFields && !safeApplyDisabled,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(getErrorMessage(data, "AI 批量补全启动失败"));
      }

      const nextTaskId = String(data.data.id);
      setTaskId(nextTaskId);
      onStarted?.(nextTaskId);
      toast.success(data.data.items?.length > 0 ? "AI 批量补全已开始" : "没有需要补全的文章项");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 批量补全启动失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="AI 批量补全" size="lg">
      <div className="space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--foreground)]">已选择 {selectedIds.length} 篇文章</p>
          <p className="mt-1 text-xs text-[var(--muted)]">任务创建后可在 AI 任务详情里查看每条输出。</p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--foreground)]">补全内容</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {actionOptions.map((option) => {
              const checked = actions.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)]"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-[var(--border)]"
                    checked={checked}
                    onChange={() => toggleAction(option.value)}
                  />
                  <span>
                    <span className="block font-medium">{option.label}</span>
                    <span className="mt-1 block text-xs text-[var(--muted)]">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--foreground)]">处理模式</legend>
          <div className="grid gap-2">
            {modeOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)]"
              >
                <input
                  type="radio"
                  className="mt-1 h-4 w-4 border-[var(--border)]"
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                />
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)]">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-[var(--border)]"
            checked={applySafeFields && !safeApplyDisabled}
            disabled={safeApplyDisabled}
            onChange={(event) => setApplySafeFields(event.target.checked)}
          />
          <span>
            <span className="block font-medium">自动应用摘要和 SEO 描述</span>
            <span className="mt-1 block text-xs text-[var(--muted)]">标签和分类仍只生成建议，不会批量覆盖。</span>
          </span>
        </label>

        {taskId ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            任务已创建：
            <Link className="font-medium underline" href={`/admin/ai/tasks/${taskId}`}>
              查看详情
            </Link>
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            关闭
          </Button>
          <Button type="button" disabled={submitting || selectedIds.length === 0 || actions.length === 0} onClick={() => void startBatch()}>
            {submitting ? "启动中..." : "开始补全"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
