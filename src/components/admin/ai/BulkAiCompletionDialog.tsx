"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/admin/ui";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type AiBatchAction = "summary" | "seo-description" | "tags" | "category" | "cover-image";
type AiBatchMode = "missing-only" | "overwrite" | "suggest-only";

const actionOptions: Array<{ value: AiBatchAction; label: string; hint: string; autoApply: boolean }> = [
  { value: "summary", label: "AI 生成摘要", hint: "可自动写入空摘要", autoApply: true },
  { value: "seo-description", label: "SEO 描述", hint: "可自动写入空 SEO 描述", autoApply: true },
  { value: "tags", label: "标签建议", hint: "只保存建议，人工确认后应用", autoApply: false },
  { value: "category", label: "分类建议", hint: "只保存建议，人工确认后应用", autoApply: false },
  { value: "cover-image", label: "AI 生成封面", hint: "生成后保存图库，可自动回填空封面", autoApply: true },
];

const modeOptions: Array<{ value: AiBatchMode; label: string; hint: string }> = [
  { value: "missing-only", label: "只补缺失", hint: "跳过已有对应字段的文章" },
  { value: "suggest-only", label: "仅生成建议", hint: "不覆盖当前字段" },
  { value: "overwrite", label: "重新生成", hint: "为所选文章重新生成建议" },
];

/**
 * 文章列表中的 AI 批量补全弹窗。
 *
 * 只负责收集批量任务参数并启动任务；实际执行、自动应用和失败记录都由后端任务流处理。
 */
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
  const [applySafeFields, setApplySafeFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const safeApplyDisabled = useMemo(() => !actions.some((action) => action === "summary" || action === "seo-description" || action === "cover-image"), [actions]);

  /**
   * 切换本次批量任务需要执行的 AI 动作。
   */
  function toggleAction(action: AiBatchAction) {
    setActions((current) => (current.includes(action) ? current.filter((item) => item !== action) : [...current, action]));
  }

  /**
   * 创建批量 AI 任务。
   *
   * 返回 taskId 后只更新弹窗状态和通知父组件，任务进度由 AI 任务页跟踪。
   */
  async function startBatch() {
    if (selectedIds.length === 0 || actions.length === 0 || submitting) {
      return;
    }

    setSubmitting(true);
    setTaskId(null);

    try {
      const data = await apiMutate<{ success?: boolean; data?: { id: string | number; items?: unknown[] } }>(
        "/api/admin/ai/batch",
        {
          method: "POST",
          body: JSON.stringify({
            postIds: selectedIds,
            actions,
            mode,
            apply: applySafeFields && !safeApplyDisabled,
          }),
        },
      );

      const nextTaskId = String(data.data?.id);
      setTaskId(nextTaskId);
      onStarted?.(nextTaskId);
      toast.success(data.data?.items && data.data.items.length > 0 ? "AI 批量补全已开始" : "没有需要补全的文章项");
    } catch (error) {
      toast.error(toErrorMessage(error, "AI 批量补全启动失败"));
    } finally {
      setSubmitting(false);
    }
  }

  const reduceMotion = useReducedMotion();
  const optionRowClassName =
    "flex cursor-pointer items-start gap-3 border-b border-[var(--border)] py-2.5 text-[var(--foreground)]";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl gap-0 overflow-y-auto p-0 sm:max-w-2xl">
        <DialogHeader className="px-6 pt-5 pb-4">
          <DialogTitle className="text-[1.375rem]">AI 批量补全</DialogTitle>
          <DialogDescription>
            已选择 <span className="font-mono font-bold text-[var(--foreground)]">{selectedIds.length}</span> 篇文章
            <span className="ed-meta-sep">·</span>
            任务创建后可在 AI 任务详情里查看每条输出。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-7 gap-y-5 px-6 pb-5 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 w-full border-b border-[var(--reader-border-strong)] pb-1.5 text-xs font-bold text-[var(--text-muted)]">补全内容</legend>
            {actionOptions.map((option) => {
              const checked = actions.includes(option.value);
              return (
                <label key={option.value} className={optionRowClassName}>
                  <input type="checkbox" className="ed-checkbox mt-0.5" checked={checked} onChange={() => toggleAction(option.value)} />
                  <span className="min-w-0">
                    <span className="block text-[0.875rem] font-bold">{option.label}</span>
                    <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{option.hint}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>

          <fieldset>
            <legend className="mb-1 w-full border-b border-[var(--reader-border-strong)] pb-1.5 text-xs font-bold text-[var(--text-muted)]">处理模式</legend>
            {modeOptions.map((option) => (
              <label key={option.value} className={optionRowClassName}>
                <input
                  type="radio"
                  name="bulk-ai-mode"
                  className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--foreground)]"
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                />
                <span className="min-w-0">
                  <span className="block text-[0.875rem] font-bold">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-[var(--text-muted)]">{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <label
            className={`flex items-start gap-3 sm:col-span-2 ${safeApplyDisabled ? "cursor-not-allowed opacity-55" : "cursor-pointer"}`}
          >
            <input
              type="checkbox"
              className="ed-checkbox mt-0.5 disabled:cursor-not-allowed"
              checked={applySafeFields && !safeApplyDisabled}
              disabled={safeApplyDisabled}
              onChange={(event) => setApplySafeFields(event.target.checked)}
            />
            <span>
              <span className="block text-[0.875rem] font-bold text-[var(--foreground)]">自动应用摘要、SEO 描述和封面</span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">标签和分类仍只生成建议，不会批量覆盖；封面只在任务输出成功后回填。</span>
            </span>
          </label>
        </div>

        <DialogFooter className="items-center border-t border-[var(--border)] px-6 py-4 sm:justify-between">
          <AnimatePresence initial={false}>
            {taskId ? (
              <motion.p
                key="task-created"
                animate={{ opacity: 1, y: 0 }}
                className="text-[0.8125rem] text-[var(--success)]"
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                role="status"
                transition={{ duration: 0.2 }}
              >
                任务已创建：
                <Link className="ed-link font-bold" href={`/admin/ai/tasks/${taskId}`}>
                  查看详情
                </Link>
                <span aria-hidden="true"> →</span>
              </motion.p>
            ) : (
              <span />
            )}
          </AnimatePresence>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              关闭
            </Button>
            <Button type="button" disabled={submitting || selectedIds.length === 0 || actions.length === 0} onClick={() => void startBatch()}>
              {submitting ? "启动中..." : "开始补全"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
