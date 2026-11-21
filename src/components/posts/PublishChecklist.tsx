"use client";

/**
 * 发布检查清单组件。
 *
 * 职责：
 * - 根据当前表单内容给出基础发布检查项
 * - 提供 AI 审稿入口与结果展示
 * - 适配 panel / inline / bar 三种展示模式，供不同后台布局复用
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/admin/ui";
import { InlineSpinner } from "@/components/admin/workspace/WorkspaceKit";
import { editorialEase } from "@/components/editorial";
import { cn } from "@/lib/cn";

interface PublishChecklistProps {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  seoDescription?: string;
  coverImage: string;
  variant?: "panel" | "inline" | "bar";
}

type AiReviewReport = {
  verdict: "ready" | "needs-work";
  score: number;
  summary: string;
  checks: Array<{ label: string; status: "pass" | "warn" | "fail"; detail: string }>;
  suggestions: string[];
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function getVerdictLabel(verdict: AiReviewReport["verdict"]) {
  return verdict === "ready" ? "可以发布" : "需要修改";
}

/**
 * 发布前检查面板。
 *
 * 说明：
 * - 静态 checks 负责最低限度的发布准备度判断
 * - AI 审稿负责补充更主观的结构、事实风险、可读性评估
 */
export function PublishChecklist({
  title,
  slug,
  content,
  excerpt = "",
  seoDescription = "",
  coverImage,
  variant = "panel",
}: PublishChecklistProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [review, setReview] = useState<AiReviewReport | null>(null);
  const reduceMotion = useReducedMotion();
  const fadeProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: -4 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: editorialEase } },
        exit: { opacity: 0, transition: { duration: 0.14 } },
      };
  const normalizedSlug = slug.trim();
  const normalizedSeoDescription = seoDescription.trim();
  const hasSearchDescription = Boolean(normalizedSeoDescription || excerpt.trim());
  const checks = [
    { label: "标题已填写", done: title.trim().length >= 8 },
    { label: "Slug 已生成", done: normalizedSlug.length >= 3 },
    { label: "Slug URL 安全", done: slugPattern.test(normalizedSlug) },
    { label: "正文不少于 200 字", done: content.trim().length >= 200 },
    { label: "摘要或 SEO 描述已填写", done: hasSearchDescription },
    { label: "SEO 描述长度适中", done: normalizedSeoDescription.length === 0 || (normalizedSeoDescription.length >= 80 && normalizedSeoDescription.length <= 160) },
    { label: "封面图已设置", done: coverImage.trim().length > 0 },
  ];
  const completed = checks.filter((item) => item.done).length;

  /**
   * 触发服务端 AI 审稿。
   * 仅在标题、slug、正文都存在时才发请求，避免无效消耗。
   */
  const handleReview = async () => {
    if (!title.trim() || !slug.trim() || !content.trim()) return;

    setIsReviewing(true);
    setReviewError("");

    try {
      const response = await fetch("/api/admin/posts/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, content, coverImage }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "AI 审稿失败");
      }

      setReview(data.data as AiReviewReport);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "AI 审稿失败");
    } finally {
      setIsReviewing(false);
    }
  };

  const reviewTone = review ? (review.verdict === "ready" ? "success" : "warning") : null;
  const aiReviewNode = (
    <AnimatePresence initial={false} mode="popLayout">
      {reviewError ? (
        <motion.p
          key="review-error"
          role="alert"
          className="mt-3.5 border-l-2 border-[var(--danger-foreground)] py-0.5 pl-3 text-[0.8125rem] leading-normal font-bold text-[var(--danger-foreground)]"
          {...fadeProps}
        >
          {reviewError}
        </motion.p>
      ) : null}
      {review ? (
        <motion.div
          key="review-report"
          className={cn(
            "mt-3.5 border-l-2 py-0.5 pl-3",
            reviewTone === "success" ? "border-[var(--success)]" : "border-[var(--warning)]",
          )}
          data-slot="ai-review-report"
          {...fadeProps}
        >
          <p
            className={cn(
              "text-[0.8125rem] leading-normal font-bold",
              reviewTone === "success" ? "text-[var(--success)]" : "text-[var(--warning)]",
            )}
          >
            AI 审稿：{getVerdictLabel(review.verdict)} · {review.score} 分
          </p>
          <p className="mt-1.5 text-[0.8125rem] leading-[1.65] text-[var(--text-body)]">{review.summary}</p>
          {review.checks.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {review.checks.map((item) => (
                <li key={`${item.label}-${item.detail}`} className="text-[0.8125rem] leading-[1.6] text-[var(--text-body)]">
                  {item.label}：{item.detail}
                </li>
              ))}
            </ul>
          ) : null}
          {review.suggestions.length > 0 ? (
            <div className="mt-2">
              <p className="text-xs font-bold text-[var(--text-muted)]">修改建议</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-[1.2em] text-[0.8125rem] leading-[1.65] text-[var(--text-body)]">
                {review.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  const reviewButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-busy={isReviewing || undefined}
      disabled={isReviewing || !title.trim() || !slug.trim() || !content.trim()}
      onClick={handleReview}
    >
      {isReviewing ? <InlineSpinner className="mr-0.5" /> : null}
      {isReviewing ? "审稿中..." : "AI 审稿"}
    </Button>
  );

  const summaryNode = (
    <p className="text-[0.8125rem] text-[var(--text-muted)]">
      完成{" "}
      <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">
        {completed}/{checks.length}
      </span>{" "}
      项后更适合直接发布。
    </p>
  );

  const checklistNode = (
    <ul className="mt-2" aria-label="发布检查项">
      {checks.map((item) => (
        <li
          className={cn(
            "flex items-baseline gap-2 border-b border-[var(--border)] py-[5px] text-[0.8125rem] leading-normal transition-colors duration-200",
            item.done ? "text-[var(--foreground)]" : "text-[var(--text-muted)]",
          )}
          key={item.label}
        >
          <span aria-hidden="true" className={cn("w-3 shrink-0 text-[0.6875rem]", item.done ? "text-[var(--success)]" : "text-[var(--text-muted)]")}>
            {item.done ? "●" : "○"}
          </span>
          <span>{item.label}</span>
          <span className="ed-visually-hidden">{item.done ? "已完成" : "未完成"}</span>
        </li>
      ))}
    </ul>
  );

  const contentNode = (
    <>
      {summaryNode}
      {checklistNode}
      {aiReviewNode}
    </>
  );

  if (variant === "bar") {
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {summaryNode}
          {reviewButton}
        </div>
        {checklistNode}
        {aiReviewNode}
      </div>
    );
  }

  if (variant === "inline") return contentNode;

  return (
    <section className="flex flex-col" data-slot="publish-checklist">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-base leading-snug font-bold text-[var(--foreground)]">发布清单</h2>
          <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">发布前检查标题、正文、SEO 与封面。</p>
        </div>
        {reviewButton}
      </div>
      <div className="mt-2.5">{contentNode}</div>
    </section>
  );
}
