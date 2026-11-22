export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";

import { getBlogSettings } from "@/lib/blog-settings";
import { buildPageMetadata } from "@/lib/seo";
import { listPublicTopicGuides } from "@/lib/topic-guides";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "专题导读",
    description: "按主题浏览精选文章导读路径，从入口、背景到进阶内容逐步阅读。",
    path: "/guides",
    siteUrl: settings.siteUrl,
  });
}

export default async function GuidesPage() {
  let guides: Awaited<ReturnType<typeof listPublicTopicGuides>> = [];
  let hasLoadError = false;

  try {
    guides = await listPublicTopicGuides();
  } catch (error) {
    hasLoadError = true;
    console.error("Load topic guides error:", error);
  }

  const totalPosts = guides.reduce((sum, guide) => sum + guide.posts.length, 0);

  return (
    <div className="reader-section">
      <section className="reader-banner onload-animation !min-h-0 !rounded-[var(--radius-panel)] !bg-[var(--reader-panel)] before:!hidden px-5 py-5 md:px-6 md:py-6">
        <div className="relative z-10 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="reader-chip">阅读导览</span>
            <span className="rounded-md bg-[var(--surface-alt)]/75 px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
              {guides.length} 个专题 · {totalPosts} 篇精选文章
            </span>
          </div>
          <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">专题导读</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-body)]">
            把分散文章整理成可连续阅读的主题路径，先读入口，再沿着上下文补齐背景、方法和案例。
          </p>
        </div>
      </section>

      {hasLoadError ? (
        <section role="alert" className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-7 text-sm text-[var(--danger-foreground)]">
          专题导读加载失败，请稍后重试。
        </section>
      ) : guides.length > 0 ? (
        <section className="grid gap-3.5 md:grid-cols-2">
          {guides.map((guide, index) => (
            <article key={guide.id} className="reader-feed-card group onload-animation p-5" style={{ animationDelay: `${60 + index * 25}ms` }}>
              <div className="flex h-full flex-col justify-between gap-3.5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="reader-chip">{guide.posts.length} 篇</span>
                    <span className="font-mono text-xs tabular-nums text-[var(--text-faint)]">
                      {new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(guide.createdAt))}
                    </span>
                  </div>
                  <Link href={`/guides/${guide.slug}`} className="block">
                    <h2 className="text-90 text-lg font-bold leading-snug transition-colors group-hover:text-[var(--brand)] md:text-xl">
                      {guide.title}
                    </h2>
                  </Link>
                  {guide.description ? (
                    <p className="line-clamp-2 text-sm leading-6 text-[var(--text-body)]">{guide.description}</p>
                  ) : null}
                </div>
                <Link href={`/guides/${guide.slug}`} className="reader-link self-end text-xs font-semibold">
                  进入导读 ›
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="reader-panel p-7 text-sm text-[var(--text-muted)]">当前还没有已发布的专题导读。</section>
      )}
    </div>
  );
}
