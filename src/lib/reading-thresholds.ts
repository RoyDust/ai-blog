export const QUALIFIED_READING_MIN_SECONDS = 20;
export const QUALIFIED_READING_MIN_SCROLL_DEPTH = 35;
export const ARTICLE_COMPLETION_SCROLL_DEPTH = 85;

export function normalizeReadingDurationSeconds(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(86_400, Math.trunc(numeric)));
}

export function normalizeReadingScrollDepth(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function isQualifiedReadingEventInput(durationSeconds: number, scrollDepth: number) {
  return durationSeconds >= QUALIFIED_READING_MIN_SECONDS || scrollDepth >= QUALIFIED_READING_MIN_SCROLL_DEPTH;
}
