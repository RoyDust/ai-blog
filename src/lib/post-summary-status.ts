export const POST_SUMMARY_STATUSES = {
  empty: "EMPTY",
  queued: "QUEUED",
  generating: "GENERATING",
  generated: "GENERATED",
  failed: "FAILED",
} as const;

export type PostSummaryStatus = (typeof POST_SUMMARY_STATUSES)[keyof typeof POST_SUMMARY_STATUSES];

export const ACTIVE_SUMMARY_STATUSES: PostSummaryStatus[] = [
  POST_SUMMARY_STATUSES.queued,
  POST_SUMMARY_STATUSES.generating,
];

export function isActiveSummaryStatus(status: string | null | undefined) {
  return ACTIVE_SUMMARY_STATUSES.includes(status as PostSummaryStatus);
}

export function getSummaryStatusForExcerpt(excerpt: string | null | undefined) {
  return excerpt?.trim() ? POST_SUMMARY_STATUSES.generated : POST_SUMMARY_STATUSES.empty;
}

export function getSummaryFieldsForExcerpt(excerpt: string | null | undefined) {
  const hasExcerpt = Boolean(excerpt?.trim());

  return {
    summaryStatus: hasExcerpt ? POST_SUMMARY_STATUSES.generated : POST_SUMMARY_STATUSES.empty,
    summaryError: null,
    summaryGeneratedAt: hasExcerpt ? new Date() : null,
  };
}

export function getOptionalSummaryFieldsForExcerpt(excerpt: string | null | undefined) {
  if (excerpt === undefined) {
    return {};
  }

  return getSummaryFieldsForExcerpt(excerpt);
}
