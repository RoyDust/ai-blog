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
      <section className="reader-banner onload-animation px-6 py-8 md:px-8 md:py-10">
        <div className="relative z-10 flex min-h-[calc(var(--reader-banner-height)-4rem)] flex-col justify-end gap-6">
          <span className="reader-chip w-fit">专题</span>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-90 text-4xl font-black leading-tight md:text-5xl">专题导读</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base">
              把分散文章整理成可连续阅读的主题路径。先读入口，再沿着上下文补齐背景、方法和案例。
            </p>
          </div>
          <div className="reader-panel w-fit rounded-2xl px-4 py-3 text-sm font-medium text-[var(--foreground)]">
            {guides.length} 个专题 · {totalPosts} 篇精选文章
          </div>
        </div>
      </section>

      {hasLoadError ? (
        <section role="alert" className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-8 text-sm text-[var(--danger-foreground)]">
          专题导读加载失败，请稍后重试。
        </section>
      ) : guides.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2">
          {guides.map((guide, index) => (
            <article key={guide.id} className="reader-feed-card onload-animation p-6 md:p-7" style={{ animationDelay: `${80 + index * 30}ms` }}>
              <div className="flex h-full flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="reader-chip">{guide.posts.length} 篇</span>
                  <span className="text-xs text-[var(--text-faint)]">
                    {new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(guide.createdAt))}
                  </span>
                </div>
                <div className="space-y-2">
                  <Link href={`/guides/${guide.slug}`} className="block">
                    <h2 className="text-90 text-2xl font-extrabold leading-tight transition-colors hover:text-accent-sky-82">
                      {guide.title}
                    </h2>
                  </Link>
                  {guide.description ? (
                    <p className="line-clamp-3 text-sm leading-6 text-[var(--text-body)]">{guide.description}</p>
                  ) : null}
                </div>
                <Link href={`/guides/${guide.slug}`} className="reader-link mt-auto text-sm font-semibold">
                  进入导读
                </Link>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="reader-panel p-8 text-sm text-[var(--text-muted)]">当前还没有已发布的专题导读。</section>
      )}
    </div>
  );
}
