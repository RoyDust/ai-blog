import { pinyin } from "pinyin-pro";

// 后台和作者工作台统一复用这条长度约束，避免生成的 slug 过长。
export const POST_SLUG_MAX_LENGTH = 60;

function normalizeSlugPart(value: string) {
  // 每个分片都先清洗成 URL 安全的片段，避免中英文混排时留下多余符号。
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function generatePostSlug(title: string, maxLength = POST_SLUG_MAX_LENGTH) {
  // 先把中文标题转成拼音数组，英文和数字会按连续片段保留下来。
  const transliterated = pinyin(title.trim(), {
    toneType: "none",
    type: "array",
    nonZh: "consecutive",
    v: false,
  });

  const slug = transliterated
    .map((part) => normalizeSlugPart(part))
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // 标题全是符号等极端情况时，给一个稳定的兜底 slug。
  if (!slug) {
    return "post";
  }

  if (slug.length <= maxLength) {
    return slug;
  }

  // 截断时顺手清掉边缘多余的连字符，避免出现不完整的结尾。
  const truncated = slug.slice(0, maxLength).replace(/-+$/g, "").replace(/^-+/g, "");
  return truncated || "post";
}
