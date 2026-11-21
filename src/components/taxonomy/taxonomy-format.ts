/**
 * 专题页报头与目录项共用的小工具。
 */

const DAILY_SERIES_PATTERN = /日报|daily/i;

/**
 * 系列状态词（简报 16.5：写在 meta 开头，不用 chip）。
 *
 * 数据模型里没有「已完结」字段，只能区分「每日更新」（如 AI 日报）和默认的「连载中」；
 * 以后 Series 加上状态字段时在这里接入「已完结」。
 */
export function getSeriesStatusLabel(series: { title: string; slug: string }) {
  return DAILY_SERIES_PATTERN.test(series.title) || DAILY_SERIES_PATTERN.test(series.slug) ? "每日更新" : "连载中";
}

/** 取一组文章里最新的发布时间（用于「最近更新」） */
export function getLatestDate(items: Array<{ createdAt: string | Date }>) {
  let latest: Date | null = null;
  for (const item of items) {
    const date = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }
    if (!latest || date.getTime() > latest.getTime()) {
      latest = date;
    }
  }
  return latest;
}
