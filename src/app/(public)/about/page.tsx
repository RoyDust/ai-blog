import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Code2,
  Coffee,
  Database,
  Github,
  Globe,
  GraduationCap,
  Heart,
  Lightbulb,
  Mail,
  Monitor,
  Palette,
  Target,
  Twitter,
  Wrench,
  Zap,
} from "lucide-react";
import { buildPageMetadata } from "@/lib/seo";

const aboutProfile = {
  name: "RoyDust", 
  avatar: "https://github.com/shadcn.png",
  bio: "全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。",
  links: [
    { name: "GitHub", url: "https://github.com", icon: Github },
    { name: "Twitter", url: "https://twitter.com", icon: Twitter },
    { name: "Email", url: "mailto:example@example.com", icon: Mail },
  ],
};

const aboutFacts = [
  { icon: GraduationCap, text: "软件工程背景，持续把设计思维与工程实践结合到产品开发里。" },
  { icon: Lightbulb, text: "关注前端体验、交互细节与内容表达，希望做出让人愿意停留的界面。" },
  { icon: Target, text: "偏爱可维护、可复用、可演进的实现方式，也重视页面最终给用户的感受。" },
  { icon: Palette, text: "乐于在代码之外思考视觉系统、内容层次与品牌气质。" },
];

const techStack = [
  {
    title: "Next.js",
    description: "使用现代 App Router 构建内容站点，兼顾性能、SEO 与开发效率。",
    icon: Zap,
  },
  {
    title: "Prisma",
    description: "通过类型安全的数据访问层支撑稳定的内容管理与发布流程。",
    icon: Database,
  },
  {
    title: "TypeScript",
    description: "为复杂交互和持续迭代提供更可靠的类型约束与重构体验。",
    icon: Code2,
  },
  {
    title: "设计系统",
    description: "围绕主题令牌、组件一致性与阅读体验建立更完整的前端表达。",
    icon: Wrench,
  },
];

export const metadata: Metadata = buildPageMetadata({
  title: "关于",
  description: aboutProfile.bio,
  path: "/about",
});

export default function AboutPage() {
  return (
    <div className="space-y-6">
      <section className="card-base relative overflow-hidden p-8 text-center md:p-12">
        <div className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_12%,transparent)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)] blur-3xl" />

        <div className="relative mx-auto mb-6 h-32 w-32 overflow-hidden rounded-full ring-4 ring-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] ring-offset-4 ring-offset-[var(--card-bg)]">
          <Image alt={aboutProfile.name} className="object-cover" fill priority sizes="128px" src={aboutProfile.avatar} />
        </div>

        <h1 className="text-90 text-3xl font-bold md:text-4xl">{aboutProfile.name}</h1>
        <p className="text-75 mx-auto mt-4 max-w-2xl text-base leading-8 md:text-lg">{aboutProfile.bio}</p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {aboutProfile.links.map((link) => {
            const Icon = link.icon;

            return (
              <Link
                key={link.name}
                className="btn-regular scale-animation flex h-11 items-center gap-2 rounded-lg px-5"
                href={link.url}
                rel={link.url.startsWith("http") ? "noopener noreferrer" : undefined}
                target={link.url.startsWith("http") ? "_blank" : undefined}
              >
                <Icon className="h-5 w-5" />
                {link.name}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="card-base p-6 md:p-8">
        <div className="mb-6 space-y-2 text-center">
          <p className="text-75 text-sm uppercase tracking-[0.3em]">Profile</p>
          <h2 className="text-90 flex items-center justify-center gap-2 text-2xl font-bold md:text-3xl">
            <Monitor className="h-6 w-6 text-[var(--primary)]" />关于我
          </h2>
          <p className="text-75 mx-auto max-w-2xl">喜欢把工程理性和审美表达放在同一个页面里，让内容、交互和氛围自然地协作。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {aboutFacts.map((fact) => {
            const Icon = fact.icon;

            return (
              <div key={fact.text} className="rounded-2xl bg-black/[0.03] p-5 text-sm leading-7 text-[var(--muted)] dark:bg-white/[0.04]">
                <p className="flex items-start gap-3">
                  <Icon className="mt-1 h-5 w-5 shrink-0 text-[var(--primary)]" />
                  <span>{fact.text}</span>
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card-base p-6 md:p-8">
        <h2 className="text-90 mb-4 text-2xl font-bold">关于本站</h2>
        <div className="space-y-4 text-[15px] leading-8 text-[var(--muted)]">
          <p>这个页面参考了 `BlogT3` 的关于页结构，延续了它偏重内容表达、个人介绍与技术栈展示的编排方式。</p>
          <p>整体目标是提供一个更完整的作者介绍入口，让访问者除了阅读文章之外，也能快速了解作者背景、技术关注点以及这个站点的构建思路。</p>
        </div>
      </section>

      <section className="card-base p-6 md:p-8">
        <h2 className="text-90 mb-6 text-2xl font-bold">技术栈</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {techStack.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="rounded-2xl bg-black/[0.03] p-5 dark:bg-white/[0.04]">
                <h3 className="text-90 mb-2 flex items-center gap-2 font-bold">
                  <Icon className="h-5 w-5 text-[var(--primary)]" />
                  {item.title}
                </h3>
                <p className="text-75 text-sm leading-7">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card-base p-6 text-center md:p-8">
        <h2 className="text-90 mb-4 text-2xl font-bold">联系我</h2>
        <p className="text-75 mx-auto mb-6 max-w-2xl">如果你想交流内容创作、前端体验、开源项目，或者只是打个招呼，都可以通过下面这些方式联系我。</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="btn-plain scale-animation flex h-11 items-center gap-2 rounded-lg px-5" href="mailto:example@example.com">
            <Mail className="h-5 w-5" />发送邮件
          </Link>
          <Link
            className="btn-plain scale-animation flex h-11 items-center gap-2 rounded-lg px-5"
            href="https://github.com"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Globe className="h-5 w-5" />访问 GitHub
          </Link>
        </div>
      </section>

      <div className="text-75 flex items-center justify-center gap-2 py-4 text-center text-sm">
        用 <Heart className="h-4 w-4 fill-current text-[var(--primary)]" /> 和 <Coffee className="h-4 w-4 text-[var(--primary)]" /> 持续打磨这个博客。
      </div>
    </div>
  );
}
