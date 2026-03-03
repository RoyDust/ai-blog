import Image from "next/image";
import Link from "next/link";
import { Folder, Github, Mail, Tag, Twitter } from "lucide-react";

const profile = {
  name: "My Blog",
  avatar: "https://github.com/shadcn.png",
  bio: "全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。",
  links: [
    { name: "GitHub", url: "https://github.com", icon: Github },
    { name: "Twitter", url: "https://twitter.com", icon: Twitter },
    { name: "Email", url: "mailto:example@example.com", icon: Mail },
  ],
};

const defaultCategories = [
  { id: "c1", name: "前端", slug: "frontend", count: 12 },
  { id: "c2", name: "后端", slug: "backend", count: 8 },
  { id: "c3", name: "工程化", slug: "tooling", count: 5 },
];

const defaultTags = [
  { id: "t1", name: "Next.js", slug: "nextjs" },
  { id: "t2", name: "Prisma", slug: "prisma" },
  { id: "t3", name: "TypeScript", slug: "typescript" },
  { id: "t4", name: "UI", slug: "ui" },
];

export function Sidebar() {
  return (
    <aside id="sidebar" className="onload-animation w-[17.5rem] shrink-0">
      <div className="sticky top-[5.5rem] space-y-4">
        <div className="card-base p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-4 h-24 w-24 overflow-hidden rounded-full ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--card-bg)]">
              <Image alt={profile.name} className="object-cover" fill sizes="96px" src={profile.avatar} />
            </div>
            <h2 className="text-90 mb-2 text-xl font-bold">{profile.name}</h2>
            <p className="text-75 mb-4 text-sm leading-relaxed">{profile.bio}</p>
            <div className="flex gap-2">
              {profile.links.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    aria-label={link.name}
                    className="btn-plain scale-animation h-9 w-9 rounded-lg"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <Folder className="h-5 w-5 text-[var(--primary)]" />
            <h3 className="text-90 font-bold">分类</h3>
          </div>
          <div className="space-y-2">
            {defaultCategories.map((category) => (
              <Link
                key={category.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-[var(--btn-plain-bg-hover)]"
                href={`/categories/${category.slug}`}
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  <span className="text-75 text-sm">{category.name}</span>
                </div>
                <span className="text-50 text-xs">{category.count}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="card-base p-6">
          <div className="mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5 text-[var(--primary)]" />
            <h3 className="text-90 font-bold">标签</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {defaultTags.map((tag) => (
              <Link
                key={tag.id}
                className="rounded-full bg-[var(--btn-regular-bg)] px-3 py-1 text-xs text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]"
                href={`/tags/${tag.slug}`}
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>

        <Link href="/posts" className="card-base flex items-center justify-between p-4 transition hover:bg-[var(--btn-card-bg-hover)]">
          <span className="text-75 font-medium">文章归档</span>
          <span className="text-50 text-sm">查看全部 →</span>
        </Link>
      </div>
    </aside>
  );
}
