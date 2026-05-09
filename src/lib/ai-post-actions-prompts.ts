import type { PostForAi } from "@/lib/ai-post-actions";

export type ChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type TagForAi = {
  id: string;
  name: string;
  slug: string;
};

export type CategoryForAi = {
  id: string;
  name: string;
  slug: string;
};

export function extractChatText(payload: ChatPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

export function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced ?? trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,|，|、/)
      .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
}

function toCandidateStrings(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") {
        return [item.trim()].filter(Boolean);
      }

      if (item && typeof item === "object") {
        const record = item as { id?: unknown; slug?: unknown; name?: unknown };
        return [record.id, record.slug, record.name].filter(
          (candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0,
        );
      }

      return [];
    });
  }

  return toStringArray(value);
}

function normalizeTagCandidate(value: string) {
  return value
    .trim()
    .replace(/^[#\[\]{}()'"“”‘’\s]+|[#\[\]{}()'"“”‘’\s]+$/g, "")
    .toLowerCase();
}

export function resolveExistingTagsFromAiOutput({
  parsed,
  fallbackText,
  tags,
}: {
  parsed: Record<string, unknown> | null;
  fallbackText: string;
  tags: TagForAi[];
}) {
  const candidates = [
    ...toCandidateStrings(parsed?.tagIds),
    ...toCandidateStrings(parsed?.selectedTagIds),
    ...toCandidateStrings(parsed?.ids),
    ...toCandidateStrings(parsed?.existingTagIds),
    ...toCandidateStrings(parsed?.tagSlugs),
    ...toCandidateStrings(parsed?.slugs),
    ...toCandidateStrings(parsed?.tags),
    ...toCandidateStrings(parsed?.selectedTags),
    ...toCandidateStrings(parsed?.existingTags),
    ...toCandidateStrings(parsed?.names),
    ...toCandidateStrings(parsed?.tagNames),
    ...(parsed ? [] : toCandidateStrings(fallbackText)),
  ];
  const selected: TagForAi[] = [];
  const seenIds = new Set<string>();
  const orderedTags = [...tags].sort((left, right) => Math.max(right.name.length, right.slug.length) - Math.max(left.name.length, left.slug.length));

  for (const candidate of candidates) {
    const normalized = normalizeTagCandidate(candidate);
    if (!normalized) continue;

    const exactMatch = orderedTags.find((tag) =>
      [tag.id, tag.slug, tag.name].some((value) => normalizeTagCandidate(value) === normalized),
    );
    const looseMatch =
      exactMatch ??
      orderedTags.find((tag) => {
        const name = normalizeTagCandidate(tag.name);
        const slug = normalizeTagCandidate(tag.slug);

        return normalized.includes(`(${slug})`) || normalized.includes(name) || normalized.includes(slug);
      });

    if (looseMatch && !seenIds.has(looseMatch.id)) {
      selected.push(looseMatch);
      seenIds.add(looseMatch.id);
    }

    if (selected.length >= 5) {
      break;
    }
  }

  return selected;
}

export function buildPostAiBaseContext(post: PostForAi, content: string) {
  return [
    `标题：${post.title}`,
    `Slug：${post.slug}`,
    post.excerpt ? `当前摘要：${post.excerpt}` : undefined,
    post.seoDescription ? `当前 SEO 描述：${post.seoDescription}` : undefined,
    post.category ? `当前分类：${post.category.name} (${post.category.slug})` : "当前分类：未分类",
    post.tags.length > 0 ? `当前标签：${post.tags.map((tag) => tag.name).join("、")}` : "当前标签：无",
    `正文：\n${content}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildSeoDescriptionPrompt(baseContext: string) {
  return `请为下面文章生成一段中文 SEO description，80 到 150 个中文字符。只输出描述正文。\n\n${baseContext}`;
}

export function buildTitlePrompt(baseContext: string) {
  return `请为下面文章给出 3 个中文标题候选。只输出 JSON：{"titles":["标题1","标题2","标题3"]}\n\n${baseContext}`;
}

export function buildSlugPrompt(baseContext: string) {
  return `请为下面文章生成一个 URL 安全 slug。只输出 slug，不要解释。\n\n${baseContext}`;
}

export function buildTagsPrompt(tags: TagForAi[], baseContext: string) {
  return `请根据文章从已有标签中推荐 1 到 5 个最合适的标签。只能从已有标签中选择，不要发明新标签，不要输出列表之外的标签。已有标签 JSON：${JSON.stringify(tags.map((tag) => ({ id: tag.id, name: tag.name, slug: tag.slug })))}。只输出 JSON：{"tagIds":["已有标签id"],"names":["已有标签名"]}\n\n${baseContext}`;
}

export function buildCategoryPrompt(categories: CategoryForAi[], baseContext: string) {
  return `请从已有分类中为文章选择最合适的一个。已有分类：${categories.map((category) => `${category.name}(${category.slug})`).join("、") || "无"}。只输出 JSON：{"categorySlug":"slug","reason":"一句理由"}\n\n${baseContext}`;
}
