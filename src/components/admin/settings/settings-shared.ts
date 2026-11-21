import { z } from "zod";
import { FileText, Globe2, HardDrive, Mail, ShieldCheck, Target, UserRound } from "lucide-react";

export type SettingsUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: string;
  githubLinked: boolean;
};

export type BlogSettingsDraft = {
  siteName: string;
  siteDescription: string;
  siteUrl: string;
  locale: string;
  appearance: {
    backgroundImageUrl: string;
  };
  profile: {
    subtitle: string;
    tagline: string;
    bio: string;
    intro: string;
    githubUrl: string;
    twitterUrl: string;
  };
  about: {
    aboutTitle: string;
    aboutParagraphs: string[];
    nowTitle: string;
    nowItems: string[];
    highlights: Array<{ title: string; description: string }>;
    stackTitle: string;
    stack: Array<{ title: string; description: string }>;
    contactTitle: string;
    contactDescription: string;
  };
  reading: {
    monthlyGoal: number;
  };
  newsletter: {
    enabled: boolean;
    provider: "none" | "log";
    fromEmail: string;
    replyTo: string;
  };
};

export type OperationLogSettings = {
  maxStorageBytes: number;
  maxStorageMb: number;
  currentStorageBytes: number;
  currentStorageLabel: string;
  rowCount: number;
};

export type SettingsTabId = "account" | "site" | "publicProfile" | "reading" | "newsletter" | "about" | "logs";

export const profileSchema = z.object({
  name: z.string().trim().min(1, "请输入显示名称").max(80, "显示名称最多 80 字"),
  email: z.string().trim().email("请输入有效的邮箱地址"),
  image: z.string(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export const logSettingsSchema = z.object({
  maxStorageMb: z.number().int("必须是整数").min(1, "日志大小限制必须在 1 到 512 MB 之间").max(512, "日志大小限制必须在 1 到 512 MB 之间"),
});

export type LogSettingsFormValues = z.infer<typeof logSettingsSchema>;

export const blogSiteFormSchema = z.object({
  siteName: z.string().trim().min(1, "请输入博客名称"),
  siteDescription: z.string(),
  siteUrl: z.string().trim().min(1, "请输入站点地址"),
  locale: z.string().trim().min(1, "请输入默认语言"),
  appearance: z.object({ backgroundImageUrl: z.string() }),
});

export const blogProfileFormSchema = z.object({
  profile: z.object({
    subtitle: z.string(),
    tagline: z.string(),
    bio: z.string(),
    intro: z.string(),
    githubUrl: z.string(),
    twitterUrl: z.string(),
  }),
});

export const blogReadingFormSchema = z.object({
  reading: z.object({ monthlyGoal: z.number().int().min(1, "每月目标篇数至少 1").max(999, "每月目标篇数最多 999") }),
});

export const blogNewsletterFormSchema = z.object({
  newsletter: z.object({
    enabled: z.boolean(),
    provider: z.enum(["none", "log"]),
    fromEmail: z.string(),
    replyTo: z.string(),
  }),
});

export const blogAboutFormSchema = z.object({
  about: z.object({
    aboutTitle: z.string(),
    aboutParagraphs: z.array(z.string()),
    nowTitle: z.string(),
    nowItems: z.array(z.string()),
    highlights: z.array(z.object({ title: z.string(), description: z.string() })),
    stackTitle: z.string(),
    stack: z.array(z.object({ title: z.string(), description: z.string() })),
    contactTitle: z.string(),
    contactDescription: z.string(),
  }),
});

export const blogSettingsFormSchema = blogSiteFormSchema
  .merge(blogProfileFormSchema)
  .merge(blogReadingFormSchema)
  .merge(blogNewsletterFormSchema)
  .merge(blogAboutFormSchema);

export type BlogSettingsFormValues = z.infer<typeof blogSettingsFormSchema>;

export const settingsTabs = [
  { id: "account", label: "账号资料", description: "登录身份", icon: UserRound },
  { id: "site", label: "站点基础", description: "头部与页脚", icon: Globe2 },
  { id: "publicProfile", label: "公开个人信息栏", description: "侧栏资料", icon: ShieldCheck },
  { id: "reading", label: "阅读目标", description: "前台统计", icon: Target },
  { id: "newsletter", label: "邮件订阅", description: "订阅基础", icon: Mail },
  { id: "about", label: "关于页面", description: "页面文案", icon: FileText },
  { id: "logs", label: "日志策略", description: "后台运维", icon: HardDrive },
] satisfies Array<{ id: SettingsTabId; label: string; description: string; icon: typeof UserRound }>;

export function toMultiline(items: string[]) {
  return items.join("\n");
}

export function fromMultiline(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toCssImageUrl(value: string) {
  const url = value.trim() || "/images/fuwari-night-city-bg.svg";
  return `url("${url.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "").replaceAll("\r", "")}")`;
}
