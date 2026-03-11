import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Briefcase,
  Code2,
  Database,
  Github,
  Mail,
  Monitor,
  NotebookPen,
  Palette,
  Radio,
  Twitter,
  Zap,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";

const profile = {
  name: "Zhang Wei",
  avatar: "https://github.com/shadcn.png",
  bio: "全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。",
  tagline: "内容创作 / 前端体验 / 开源实践",
  intro:
    "我更喜欢把个人主页做成一个适合停留和阅读的地方，而不是只堆一组链接。这里既是作者简介，也是我表达工作方法、内容方向与技术偏好的入口。",
  links: [
    { name: "GitHub", url: "https://github.com", icon: Github },
    { name: "Twitter", url: "https://twitter.com", icon: Twitter },
    { name: "Email", url: "mailto:example@example.com", icon: Mail },
  ],
};

const highlights = [
  {
    title: "内容创作",
    description: "持续记录前端工程、交互体验与实际项目中的取舍，希望把复杂问题写得更容易理解。",
    icon: NotebookPen,
  },
  {
    title: "产品感知",
    description: "关注界面层次、信息密度和阅读节奏，让页面既实用又不失性格。",
    icon: Palette,
  },
  {
    title: "工程实践",
    description: "偏爱清晰的结构、稳定的抽象和可持续迭代的实现方式，而不是短期堆砌功能。",
    icon: Briefcase,
  },
];

const nowWorkingOn = [
  "把博客打磨成更完整的个人表达空间，而不仅是文章列表。",
  "持续优化阅读体验、匿名互动与内容归档结构。",
  "在 Next.js、Prisma 和 TypeScript 体系里积累可复用的内容站模式。",
];

const stack = [
  {
    title: "Next.js",
    description: "用 App Router 组织内容结构、页面元数据和渐进式交互。",
    icon: Zap,
  },
  {
    title: "TypeScript",
    description: "让内容站里的组件、状态和交互迭代更稳，也更适合长期维护。",
    icon: Code2,
  },
  {
    title: "Prisma",
    description: "为文章、评论、点赞与资料页这些内容模型提供可靠的数据访问层。",
    icon: Database,
  },
  {
    title: "设计系统",
    description: "围绕主题变量、组件一致性和阅读型排版建立更统一的界面语言。",
    icon: Monitor,
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: "关于",
  description: profile.bio,
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="card-base onload-animation relative overflow-hidden px-6 py-8 md:px-10 md:py-10">
        <div className="pointer-events-none absolute top-0 right-0 h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-10 h-24 w-24 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_8%,transparent)] blur-2xl" />

        <div className="grid gap-8 lg:grid-cols-[160px_minmax(0,1fr)] lg:items-start">
          <div
            className="onload-animation relative h-32 w-32 overflow-hidden rounded-3xl ring-1 ring-black/8 ring-offset-4 ring-offset-[var(--card-bg)] dark:ring-white/10 md:h-40 md:w-40"
            style={{ animationDelay: "80ms" }}
          >
            <Image alt={profile.name} className="object-cover" fill priority sizes="160px" src={profile.avatar} />
          </div>

          <div className="space-y-5">
            <div className="onload-animation space-y-3" style={{ animationDelay: "140ms" }}>
              <p className="text-50 text-xs font-medium uppercase tracking-[0.32em]">About</p>
              <div className="space-y-2">
                <h1 className="text-90 text-4xl font-bold tracking-tight md:text-5xl">{profile.name}</h1>
                <p className="text-[var(--primary)] text-sm font-medium md:text-base">{profile.tagline}</p>
              </div>
              <p className="text-75 max-w-3xl text-base leading-8 md:text-lg">{profile.bio}</p>
              <p className="text-75 max-w-3xl text-sm leading-7 md:text-[15px]">{profile.intro}</p>
            </div>

            <div className="onload-animation flex flex-wrap gap-3" style={{ animationDelay: "200ms" }}>
              {profile.links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.name}
                    href={link.url}
                    rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    target={link.url.startsWith("http") ? "_blank" : undefined}
                    className="btn-regular scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5"
                  >
                    <Icon className="h-4 w-4" />
                    {link.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="onload-animation grid gap-6 lg:grid-cols-[1.15fr_0.85fr]" style={{ animationDelay: "90ms" }}>
        <div className="card-base p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-90 text-2xl font-bold">关于我</h2>
          </div>
          <div className="space-y-4 text-[15px] leading-8 text-[var(--muted)]">
            <p>
              我希望内容型个人主页首先是“可读”的：信息不拥挤，叙述有顺序，访问者能很快理解我是谁、在关注什么、以及这个站点为什么存在。
            </p>
            <p>
              比起炫技式展示，我更在意长期写作、界面表达和工程实现之间的平衡。文章、交互、主题与页面结构，都会服务于同一个目标：把内容传递得更自然。
            </p>
          </div>
        </div>

        <div className="card-base p-6 md:p-8">
          <div className="mb-5 flex items-center gap-2">
            <Radio className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-90 text-2xl font-bold">我在做什么</h2>
          </div>
          <div className="space-y-3">
            {nowWorkingOn.map((item) => (
              <div key={item} className="rounded-2xl bg-black/[0.03] px-4 py-4 text-sm leading-7 text-[var(--muted)] dark:bg-white/[0.04]">
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stagger-children grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="group card-base p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--btn-card-bg-hover)] hover:shadow-[0_18px_45px_-24px_rgba(15,23,42,0.35)]"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-90 mb-2 text-lg font-bold transition-colors duration-300 group-hover:text-[var(--primary)]">
                {item.title}
              </h3>
              <p className="text-75 text-sm leading-7">{item.description}</p>
            </article>
          );
        })}
      </section>

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: "140ms" }}>
        <div className="mb-6 flex items-center gap-2">
          <Monitor className="h-5 w-5 text-[var(--primary)]" />
          <h2 className="text-90 text-2xl font-bold">技术栈</h2>
        </div>
        <div className="stagger-children grid gap-4 md:grid-cols-2">
          {stack.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="group rounded-2xl border border-black/5 bg-black/[0.02] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--primary)_22%,transparent)] hover:bg-[color:color-mix(in_srgb,var(--primary)_6%,transparent)] dark:border-white/8 dark:bg-white/[0.03]"
              >
                <h3 className="text-90 mb-2 flex items-center gap-2 font-bold transition-colors duration-300 group-hover:text-[var(--primary)]">
                  <Icon className="h-5 w-5 text-[var(--primary)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  {item.title}
                </h3>
                <p className="text-75 text-sm leading-7">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section
        className="card-base onload-animation flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between md:p-8"
        style={{ animationDelay: "180ms" }}
      >
        <div className="space-y-2">
          <h2 className="text-90 text-2xl font-bold">联系我</h2>
          <p className="text-75 max-w-2xl text-sm leading-7">
            如果你想聊内容创作、前端体验、个人站点设计，或者只是想打个招呼，都欢迎通过这些方式找到我。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link className="btn-plain scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5" href="mailto:example@example.com">
            <Mail className="h-4 w-4" />发送邮件
          </Link>
          <Link
            className="btn-plain scale-animation inline-flex h-11 items-center gap-2 rounded-xl px-5"
            href="https://github.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github className="h-4 w-4" />访问 GitHub
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
