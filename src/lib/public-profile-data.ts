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

export type PublicProfileContent = {
  subtitle: string;
  tagline: string;
  bio: string;
  intro: string;
  githubUrl: string;
  twitterUrl: string;
};

const fallbackEmail = "roydust@foxmail.com";

export const PUBLIC_PROFILE_CONTENT_FALLBACK: PublicProfileContent = {
  subtitle: "专注前端开发与工程实践",
  tagline: "内容创作 / 前端体验 / 开源实践",
  bio: "全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。",
  intro:
    "我更喜欢把个人主页做成一个适合停留和阅读的地方，而不是只堆一组链接。这里既是作者简介，也是我表达工作方法、内容方向与技术偏好的入口。",
  githubUrl: "https://github.com/RoyDust",
  twitterUrl: "https://x.com/luoyichen12",
};

export const PUBLIC_PROFILE_FALLBACK: PublicProfile = {
  name: "Zhang Wei",
  initials: "ZW",
  avatar: "https://avatars.githubusercontent.com/u/50167909",
  email: fallbackEmail,
  subtitle: PUBLIC_PROFILE_CONTENT_FALLBACK.subtitle,
  tagline: PUBLIC_PROFILE_CONTENT_FALLBACK.tagline,
  bio: PUBLIC_PROFILE_CONTENT_FALLBACK.bio,
  intro: PUBLIC_PROFILE_CONTENT_FALLBACK.intro,
  links: [
    { kind: "github", name: "GitHub", url: PUBLIC_PROFILE_CONTENT_FALLBACK.githubUrl },
    { kind: "twitter", name: "Twitter", url: PUBLIC_PROFILE_CONTENT_FALLBACK.twitterUrl },
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

function profileLinks(content: PublicProfileContent, email: string | null): PublicProfileLink[] {
  const links: Array<PublicProfileLink | null> = [
    content.githubUrl ? { kind: "github" as const, name: "GitHub", url: content.githubUrl } : null,
    content.twitterUrl ? { kind: "twitter" as const, name: "Twitter", url: content.twitterUrl } : null,
    email ? { kind: "email" as const, name: "Email", url: `mailto:${email}` } : null,
  ];

  return links.filter((link): link is PublicProfileLink => Boolean(link));
}

function mergeFallbackProfileContent(content: PublicProfileContent): PublicProfile {
  return {
    ...PUBLIC_PROFILE_FALLBACK,
    subtitle: content.subtitle,
    tagline: content.tagline,
    bio: content.bio,
    intro: content.intro,
    links: profileLinks(content, PUBLIC_PROFILE_FALLBACK.email),
  };
}

export function mergePublicProfileUser(
  user: { name?: string | null; email?: string | null; image?: string | null } | null,
  content = PUBLIC_PROFILE_CONTENT_FALLBACK,
): PublicProfile {
  if (!user) return mergeFallbackProfileContent(content);

  const name = user.name?.trim() || PUBLIC_PROFILE_FALLBACK.name;
  const email = user.email?.trim() || null;

  return {
    ...PUBLIC_PROFILE_FALLBACK,
    subtitle: content.subtitle,
    tagline: content.tagline,
    bio: content.bio,
    intro: content.intro,
    name,
    initials: getInitials(name),
    avatar: user.image?.trim() || PUBLIC_PROFILE_FALLBACK.avatar,
    email,
    links: profileLinks(content, email),
  };
}
