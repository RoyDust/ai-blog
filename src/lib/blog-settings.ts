import { ApiError, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { PUBLIC_PROFILE_CONTENT_FALLBACK, type PublicProfileContent } from "@/lib/public-profile-data";
import { normalizeMonthlyReadingGoal } from "@/lib/reading-stats";
import { getSiteUrl } from "@/lib/seo";

export const BLOG_SITE_SETTING_KEY = "blog.site";

export type BlogSettings = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  locale: string;
  profile: PublicProfileContent;
  about: AboutPageSettings;
  reading: ReadingSettings;
  newsletter: NewsletterSettings;
};

export type AboutPageCard = {
  title: string;
  description: string;
};

export type AboutPageSettings = {
  aboutTitle: string;
  aboutParagraphs: string[];
  nowTitle: string;
  nowItems: string[];
  highlights: AboutPageCard[];
  stackTitle: string;
  stack: AboutPageCard[];
  contactTitle: string;
  contactDescription: string;
};

export type ReadingSettings = {
  monthlyGoal: number;
};

export type NewsletterSettings = {
  enabled: boolean;
  provider: "none" | "log";
  fromEmail: string;
  replyTo: string;
};

export const DEFAULT_BLOG_SETTINGS: BlogSettings = {
  siteName: "My Blog",
  siteDescription: "夜读模式下整理前端、工程实践和部署笔记，让长期积累有清晰入口。",
  siteUrl: getSiteUrl(),
  locale: "zh-CN",
  profile: PUBLIC_PROFILE_CONTENT_FALLBACK,
  about: {
    aboutTitle: "关于我",
    aboutParagraphs: [
      "我希望内容型个人主页首先是“可读”的：信息不拥挤，叙述有顺序，访问者能很快理解我是谁、在关注什么、以及这个站点为什么存在。",
      "比起炫技式展示，我更在意长期写作、界面表达和工程实现之间的平衡。文章、交互、主题与页面结构，都会服务于同一个目标：把内容传递得更自然。",
    ],
    nowTitle: "我在做什么",
    nowItems: [
      "把博客打磨成更完整的个人表达空间，而不仅是文章列表。",
      "持续优化阅读体验、匿名互动与内容归档结构。",
      "在 Next.js、Prisma 和 TypeScript 体系里积累可复用的内容站模式。",
    ],
    highlights: [
      {
        title: "内容创作",
        description: "持续记录前端工程、交互体验与实际项目中的取舍，希望把复杂问题写得更容易理解。",
      },
      {
        title: "产品感知",
        description: "关注界面层次、信息密度和阅读节奏，让页面既实用又不失性格。",
      },
      {
        title: "工程实践",
        description: "偏爱清晰的结构、稳定的抽象和可持续迭代的实现方式，而不是短期堆砌功能。",
      },
    ],
    stackTitle: "技术栈",
    stack: [
      {
        title: "Next.js",
        description: "用 App Router 组织内容结构、页面元数据和渐进式交互。",
      },
      {
        title: "TypeScript",
        description: "让内容站里的组件、状态和交互迭代更稳，也更适合长期维护。",
      },
      {
        title: "Prisma",
        description: "为文章、评论、点赞与资料页这些内容模型提供可靠的数据访问层。",
      },
      {
        title: "设计系统",
        description: "围绕主题变量、组件一致性和阅读型排版建立更统一的界面语言。",
      },
    ],
    contactTitle: "联系我",
    contactDescription: "如果你想聊内容创作、前端体验、个人站点设计，或者只是想打个招呼，都欢迎通过这些方式找到我。",
  },
  reading: {
    monthlyGoal: 30,
  },
  newsletter: {
    enabled: false,
    provider: "none",
    fromEmail: "",
    replyTo: "",
  },
};

const MAX_SITE_NAME_LENGTH = 80;
const MAX_SITE_DESCRIPTION_LENGTH = 300;
const MAX_LOCALE_LENGTH = 32;
const MAX_SHORT_TEXT_LENGTH = 120;
const MAX_LONG_TEXT_LENGTH = 500;
const localePattern = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

type StoredSetting = {
  value: unknown;
};

type RawSettingsReader = {
  $queryRawUnsafe: <T = unknown>(query: string, ...values: unknown[]) => Promise<T>;
};

type RawSettingsWriter = {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<number>;
};

function isMissingRelationError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : "";
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return code === "42P01" || code === "P2021" || message.includes('relation "system_settings" does not exist');
}

function getDefaultBlogSettings(): BlogSettings {
  return {
    ...DEFAULT_BLOG_SETTINGS,
    siteUrl: getSiteUrl(),
  };
}

function coerceStoredValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function normalizeSiteUrl(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : fallback;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError("站点地址必须是有效 URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("站点地址必须使用 http 或 https");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function normalizeOptionalUrl(value: unknown, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : fallback;
  if (!raw) {
    return "";
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ValidationError("公开链接必须是有效 URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ValidationError("公开链接必须使用 http 或 https");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function normalizeText(value: unknown, fallback: string, label: string, maxLength = MAX_LONG_TEXT_LENGTH) {
  const text = typeof value === "string" ? value.trim() : fallback;
  if (!text) {
    throw new ValidationError(`${label}不能为空`);
  }

  if (text.length > maxLength) {
    throw new ValidationError(`${label}不能超过 ${maxLength} 个字符`);
  }

  return text;
}

function normalizeTextList(value: unknown, fallback: string[], label: string, maxItems: number) {
  const source = Array.isArray(value) ? value : fallback;
  const items = source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);

  if (items.length === 0) {
    throw new ValidationError(`${label}至少需要 1 项`);
  }

  return items.map((item) => normalizeText(item, "", label));
}

function normalizeCards(value: unknown, fallback: AboutPageCard[], label: string, maxItems: number) {
  const source = Array.isArray(value) ? value : fallback;
  const cards = source
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item, index) => ({
      title: normalizeText(item.title, fallback[index]?.title ?? "", `${label}标题`, MAX_SHORT_TEXT_LENGTH),
      description: normalizeText(item.description, fallback[index]?.description ?? "", `${label}描述`),
    }))
    .slice(0, maxItems);

  if (cards.length === 0) {
    throw new ValidationError(`${label}至少需要 1 项`);
  }

  return cards;
}

function normalizeProfileSettings(value: unknown, fallback: PublicProfileContent): PublicProfileContent {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    subtitle: normalizeText(record.subtitle, fallback.subtitle, "作者副标题", MAX_SHORT_TEXT_LENGTH),
    tagline: normalizeText(record.tagline, fallback.tagline, "作者标语", MAX_SHORT_TEXT_LENGTH),
    bio: normalizeText(record.bio, fallback.bio, "作者简介"),
    intro: normalizeText(record.intro, fallback.intro, "作者介绍"),
    githubUrl: normalizeOptionalUrl(record.githubUrl, fallback.githubUrl),
    twitterUrl: normalizeOptionalUrl(record.twitterUrl, fallback.twitterUrl),
  };
}

function normalizeAboutSettings(value: unknown, fallback: AboutPageSettings): AboutPageSettings {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    aboutTitle: normalizeText(record.aboutTitle, fallback.aboutTitle, "关于模块标题", MAX_SHORT_TEXT_LENGTH),
    aboutParagraphs: normalizeTextList(record.aboutParagraphs, fallback.aboutParagraphs, "关于模块段落", 4),
    nowTitle: normalizeText(record.nowTitle, fallback.nowTitle, "动态模块标题", MAX_SHORT_TEXT_LENGTH),
    nowItems: normalizeTextList(record.nowItems, fallback.nowItems, "动态条目", 6),
    highlights: normalizeCards(record.highlights, fallback.highlights, "亮点卡片", 6),
    stackTitle: normalizeText(record.stackTitle, fallback.stackTitle, "技术栈标题", MAX_SHORT_TEXT_LENGTH),
    stack: normalizeCards(record.stack, fallback.stack, "技术栈卡片", 8),
    contactTitle: normalizeText(record.contactTitle, fallback.contactTitle, "联系模块标题", MAX_SHORT_TEXT_LENGTH),
    contactDescription: normalizeText(record.contactDescription, fallback.contactDescription, "联系模块描述"),
  };
}

function normalizeReadingSettings(value: unknown, fallback: ReadingSettings): ReadingSettings {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};

  return {
    monthlyGoal: normalizeMonthlyReadingGoal(record.monthlyGoal, fallback.monthlyGoal),
  };
}

function normalizeOptionalEmail(value: unknown, fallback: string, label: string) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : fallback;
  if (!email) {
    return "";
  }

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError(`${label}必须是有效邮箱`);
  }

  return email;
}

function normalizeNewsletterSettings(value: unknown, fallback: NewsletterSettings): NewsletterSettings {
  const record = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  const provider = record.provider === "log" ? "log" : "none";

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : fallback.enabled,
    provider,
    fromEmail: normalizeOptionalEmail(record.fromEmail, fallback.fromEmail, "发件邮箱"),
    replyTo: normalizeOptionalEmail(record.replyTo, fallback.replyTo, "回复邮箱"),
  };
}

export function normalizeBlogSettingsInput(input: unknown, fallback = getDefaultBlogSettings()): BlogSettings {
  if (typeof input !== "object" || input === null) {
    throw new ValidationError("博客配置格式无效");
  }

  const record = input as Record<string, unknown>;
  const siteName = typeof record.siteName === "string" ? record.siteName.trim() : fallback.siteName;
  const siteDescription =
    typeof record.siteDescription === "string" ? record.siteDescription.trim() : fallback.siteDescription;
  const locale = typeof record.locale === "string" ? record.locale.trim() : fallback.locale;

  if (!siteName) {
    throw new ValidationError("博客名称不能为空");
  }

  if (siteName.length > MAX_SITE_NAME_LENGTH) {
    throw new ValidationError(`博客名称不能超过 ${MAX_SITE_NAME_LENGTH} 个字符`);
  }

  if (siteDescription.length > MAX_SITE_DESCRIPTION_LENGTH) {
    throw new ValidationError(`站点描述不能超过 ${MAX_SITE_DESCRIPTION_LENGTH} 个字符`);
  }

  if (!locale || locale.length > MAX_LOCALE_LENGTH || !localePattern.test(locale)) {
    throw new ValidationError("默认语言必须是有效语言标签");
  }

  return {
    siteName,
    siteDescription,
    siteUrl: normalizeSiteUrl(record.siteUrl, fallback.siteUrl),
    locale,
    profile: normalizeProfileSettings(record.profile, fallback.profile),
    about: normalizeAboutSettings(record.about, fallback.about),
    reading: normalizeReadingSettings(record.reading, fallback.reading),
    newsletter: normalizeNewsletterSettings(record.newsletter, fallback.newsletter),
  };
}

function readStoredBlogSettings(value: unknown) {
  try {
    const stored = coerceStoredValue(value);
    const fallback = getDefaultBlogSettings();
    return normalizeBlogSettingsInput(
      {
        ...fallback,
        ...(typeof stored === "object" && stored !== null ? stored : {}),
      },
      fallback,
    );
  } catch {
    return getDefaultBlogSettings();
  }
}

function hasRawSettingsReader(client: unknown): client is RawSettingsReader {
  return typeof (client as { $queryRawUnsafe?: unknown }).$queryRawUnsafe === "function";
}

function hasRawSettingsWriter(client: unknown): client is RawSettingsWriter {
  return typeof (client as { $executeRawUnsafe?: unknown }).$executeRawUnsafe === "function";
}

export async function getBlogSettings(): Promise<BlogSettings> {
  const client = prisma;
  if (!hasRawSettingsReader(client)) {
    return getDefaultBlogSettings();
  }

  try {
    const rows = await client.$queryRawUnsafe<StoredSetting[]>(
      'SELECT "value" FROM "system_settings" WHERE "key" = $1 LIMIT 1',
      BLOG_SITE_SETTING_KEY,
    );
    const setting = rows[0] ?? null;

    return setting ? readStoredBlogSettings(setting.value) : getDefaultBlogSettings();
  } catch (error) {
    if (!isMissingRelationError(error)) {
      console.error("Read blog settings error:", error);
    }

    return getDefaultBlogSettings();
  }
}

export async function updateBlogSettings(input: unknown): Promise<BlogSettings> {
  const currentSettings = await getBlogSettings();
  const settings = normalizeBlogSettingsInput(input, currentSettings);
  const client = prisma;

  if (!hasRawSettingsWriter(client)) {
    throw new ApiError(503, "博客配置持久化不可用，请检查数据库客户端配置");
  }

  await client.$executeRawUnsafe(
    `
      INSERT INTO "system_settings" ("key", "value", "updatedAt")
      VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
      ON CONFLICT ("key")
      DO UPDATE SET "value" = $2::jsonb, "updatedAt" = CURRENT_TIMESTAMP
    `,
    BLOG_SITE_SETTING_KEY,
    JSON.stringify(settings),
  );

  return settings;
}

export function toOpenGraphLocale(locale: string) {
  return locale.replaceAll("-", "_");
}
