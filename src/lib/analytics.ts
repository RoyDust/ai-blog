export const VISIT_EXCLUDED_PATH_PREFIXES = [
  "/admin",
  "/api",
  "/login",
  "/register",
  "/profile",
  "/write",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/rss.xml",
  "/llms.txt",
] as const;

const VALID_RANGE_VALUES = [7, 30, 90] as const;

export type VisitTrendRange = (typeof VALID_RANGE_VALUES)[number];

export function normalizeAnalyticsPath(path: unknown) {
  if (typeof path !== "string") return null;

  const trimmed = path.trim();
  if (!trimmed || !trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  try {
    const url = new URL(trimmed, "http://localhost");
    return url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function shouldTrackVisitPath(path: string) {
  return !VISIT_EXCLUDED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function extractPostSlugFromPath(path: string) {
  const match = path.match(/^\/posts\/([^/]+)$/);
  if (!match?.[1]) return null;

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function parseVisitTrendRange(value: unknown): VisitTrendRange {
  const numeric = Number(value);
  return VALID_RANGE_VALUES.includes(numeric as VisitTrendRange) ? (numeric as VisitTrendRange) : 7;
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function formatVisitTrendDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatVisitTrendLabel(date: Date) {
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}
