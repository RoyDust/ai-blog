/**
 * 方向 A 列表与报头使用的日期 / 计数格式。
 *
 * 统一按站点时区（Asia/Shanghai）格式化，避免服务端与浏览器时区不同导致的 hydration 不一致。
 */

const SITE_TIME_ZONE = "Asia/Shanghai";

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SITE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
  timeZone: SITE_TIME_ZONE,
  weekday: "long",
});

function toDate(value: string | Date | number) {
  return value instanceof Date ? value : new Date(value);
}

function getParts(value: string | Date | number) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = partsFormatter.formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

/** 2026-10-18 */
export function formatIsoDate(value: string | Date | number) {
  const parts = getParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

/** 10-18 */
export function formatMonthDay(value: string | Date | number) {
  const parts = getParts(value);
  return parts ? `${parts.month}-${parts.day}` : "";
}

/** 2026 */
export function formatYear(value: string | Date | number) {
  return getParts(value)?.year ?? "";
}

/** 星期二 */
export function formatWeekday(value: string | Date | number) {
  const date = toDate(value);
  return Number.isNaN(date.getTime()) ? "" : weekdayFormatter.format(date);
}

/** 两位序号：1 → 01 */
export function formatIndex(value: number) {
  return String(value).padStart(2, "0");
}

/** 阅读时长合计：85 → 1 小时 25 分；40 → 40 分钟 */
export function formatDuration(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) {
    return `${safe} 分钟`;
  }

  const hours = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest > 0 ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}
