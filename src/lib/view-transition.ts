type ViewTransitionTarget = "cover" | "title";

const PURE_ASCII_CUSTOM_IDENT_SLUG = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const MAX_SAFE_SLUG_LENGTH = 80;

function hashSlugFnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(6, "0");
}

/**
 * 将文章或系列 slug 转换为合法且无碰撞的 CSS `<custom-ident>` 片段：
 * - 空空白输入回退为 `"unknown"`
 * - 纯小写 ASCII 连字符 slug（`^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$` 且 <= 80 字符）原样保留
 * - 含中文/Unicode、特殊符号、大写字母、数字开头或超长输入追加确定性 FNV-1a 短哈希后缀，
 *   消除同屏多篇非 ASCII 文章因折叠为同一名称而触发浏览器 `ViewTransition` `InvalidStateError`
 */
export function toSafeSlug(slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) {
    return "unknown";
  }

  if (trimmed.length <= MAX_SAFE_SLUG_LENGTH && PURE_ASCII_CUSTOM_IDENT_SLUG.test(trimmed)) {
    return trimmed;
  }

  const hash = hashSlugFnv1a(trimmed);
  const rawBase = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!rawBase) {
    return `u-${hash}`;
  }

  const identBase = /^[0-9]/.test(rawBase) ? `u-${rawBase}` : rawBase;
  const maxBaseLength = Math.max(1, MAX_SAFE_SLUG_LENGTH - hash.length - 1);
  const truncatedBase = identBase.slice(0, maxBaseLength).replace(/-+$/g, "") || "u";

  return `${truncatedBase}-${hash}`;
}

export function getPostViewTransitionName(target: ViewTransitionTarget, slug: string) {
  return `post-${target}-${toSafeSlug(slug)}`;
}

export function getSeriesViewTransitionName(target: ViewTransitionTarget, slug: string) {
  return `series-${target}-${toSafeSlug(slug)}`;
}
