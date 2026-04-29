"use client";

import { useState } from "react";

interface PublishChecklistProps {
  title: string;
  slug: string;
  content: string;
  coverImage: string;
  variant?: "panel" | "inline";
}

type AiReviewReport = {
  verdict: "ready" | "needs-work";
  score: number;
  summary: string;
  checks: Array<{ label: string; status: "pass" | "warn" | "fail"; detail: string }>;
  suggestions: string[];
};

function getVerdictLabel(verdict: AiReviewReport["verdict"]) {
  return verdict === "ready" ? "可以发布" : "需要修改";
}

export function PublishChecklist({ title, slug, content, coverImage, variant = "panel" }: PublishChecklistProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [review, setReview] = useState<AiReviewReport | null>(null);
  const checks = [
    { label: "标题已填写", done: title.trim().length >= 8 },
    { label: "Slug 已生成", done: slug.trim().length >= 3 },
    { label: "正文不少于 200 字", done: content.trim().length >= 200 },
    { label: "封面图已设置", done: coverImage.trim().length > 0 },
  ];
  const completed = checks.filter((item) => item.done).length;

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

  const contentNode = (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--muted)]">完成 {completed}/4 项后更适合直接发布。</p>
        <button
          type="button"
          className="ui-btn ui-ring rounded-xl border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isReviewing || !title.trim() || !slug.trim() || !content.trim()}
          onClick={handleReview}
        >
          {isReviewing ? "审稿中..." : "AI 审稿"}
        </button>
      </div>
      <ul className="space-y-2">
        {checks.map((item) => (
          <li className="flex items-center gap-2 text-sm" key={item.label}>
            <span className={item.done ? "text-[var(--success-foreground)]" : "text-[var(--muted)]"}>{item.done ? "●" : "○"}</span>
            <span className={item.done ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>{item.label}</span>
          </li>
        ))}
      </ul>
      {reviewError ? <p className="mt-3 text-sm text-rose-500">{reviewError}</p> : null}
      {review ? (
        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            AI 审稿：{getVerdictLabel(review.verdict)} · {review.score} 分
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{review.summary}</p>
          {review.checks.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {review.checks.map((item) => (
                <li key={`${item.label}-${item.detail}`} className="text-sm text-[var(--foreground)]">
                  {item.label}：{item.detail}
                </li>
              ))}
            </ul>
          ) : null}
          {review.suggestions.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm font-medium text-[var(--foreground)]">修改建议</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--muted)]">
                {review.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (variant === "inline") return contentNode;

  return (
    <section className="ui-surface rounded-2xl p-5">
      <h3 className="mb-3 font-display text-lg font-semibold text-[var(--foreground)]">发布设置</h3>
      {contentNode}
    </section>
  );
}
