export type PublicProfileLinkKind = "email" | "github" | "link" | "twitter";

export type PublicProfileLink = {
  kind: PublicProfileLinkKind;
  name: string;
  url: string;
};

export type PublicProfile = {
  name: string;
  initials: string;
  avatar: string | null;
  email: string | null;
  subtitle: string;
  tagline: string;
  bio: string;
  intro: string;
  links: PublicProfileLink[];
};

const fallbackEmail = "roydust@foxmail.com";

export const PUBLIC_PROFILE_FALLBACK: PublicProfile = {
  name: "Zhang Wei",
  initials: "ZW",
  avatar: "https://avatars.githubusercontent.com/u/50167909",
  email: fallbackEmail,
  subtitle: "专注前端开发与工程实践",
  tagline: "内容创作 / 前端体验 / 开源实践",
  bio: "全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。",
  intro:
    "我更喜欢把个人主页做成一个适合停留和阅读的地方，而不是只堆一组链接。这里既是作者简介，也是我表达工作方法、内容方向与技术偏好的入口。",
  links: [
    { kind: "github", name: "GitHub", url: "https://github.com/RoyDust" },
    { kind: "twitter", name: "Twitter", url: "https://x.com/luoyichen12" },
    { kind: "email", name: "Email", url: `mailto:${fallbackEmail}` },
  ],
};

export function getInitials(value: string) {
  const normalized = value.trim();
  if (!normalized) return PUBLIC_PROFILE_FALLBACK.initials;

  const asciiWords = normalized.match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g);
  if (asciiWords?.length) {
    return asciiWords
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }

  return [...normalized].slice(0, 2).join("").toUpperCase();
}

export function mergePublicProfileUser(user: { name?: string | null; email?: string | null; image?: string | null } | null): PublicProfile {
  if (!user) return PUBLIC_PROFILE_FALLBACK;

  const name = user.name?.trim() || PUBLIC_PROFILE_FALLBACK.name;
  const email = user.email?.trim() || null;
  const emailLink = email ? { kind: "email" as const, name: "Email", url: `mailto:${email}` } : null;

  return {
    ...PUBLIC_PROFILE_FALLBACK,
    name,
    initials: getInitials(name),
    avatar: user.image?.trim() || PUBLIC_PROFILE_FALLBACK.avatar,
    email,
    links: [
      ...PUBLIC_PROFILE_FALLBACK.links.filter((link) => link.kind !== "email"),
      ...(emailLink ? [emailLink] : []),
    ],
  };
}
