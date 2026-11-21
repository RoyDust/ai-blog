export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PostCard } from "@/components/blog/PostCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { getBlogSettings } from "@/lib/blog-settings";
import { buildBreadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getPublicTopicGuideBySlug } from "@/lib/topic-guides";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [guide, settings] = await Promise.all([getPublicTopicGuideBySlug(slug), getBlogSettings()]);

  if (!guide) {
    return buildPageMetadata({
      title: "专题不存在",
      description: "未找到对应专题导读。",
      path: `/guides/${slug}`,
      siteUrl: settings.siteUrl,
    });
  }

  return buildPageMetadata({
    title: `${guide.title} · 专题导读`,
    description: guide.description || `按顺序浏览 ${guide.title} 专题中的精选文章。`,
    path: `/guides/${guide.slug}`,
    siteUrl: settings.siteUrl,
  });
}

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [guide, settings] = await Promise.all([getPublicTopicGuideBySlug(slug), getBlogSettings()]);

  if (!guide) {
    notFound();
    return null;
  }

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "首页", path: "/" },
    { name: "专题导读", path: "/guides" },
    { name: guide.title, path: `/guides/${guide.slug}` },
  ], { siteUrl: settings.siteUrl });

  return (
    <div className="reader-section">
      <JsonLd data={breadcrumbJsonLd} />
      <section className="reader-banner onload-animation !min-h-0 !rounded-[var(--radius-panel)] !bg-[var(--reader-panel)] before:!hidden px-5 py-5 md:px-6 md:py-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 max-w-2xl space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="reader-chip">阅读导览</span>
              <span className="rounded-md bg-[var(--surface-alt)]/75 px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
                {guide.posts.length} 篇精选文章
              </span>
            </div>
            <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">{guide.title}</h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--text-body)]">
              {guide.description || "这个专题按推荐阅读顺序组织文章，帮助你从入口进入主题并逐步建立完整上下文。"}
            </p>
          </div>
          <Link
            href="/guides"
            className="inline-flex h-[2.125rem] w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-[0.625rem] bg-[var(--btn-regular-bg)] px-3.5 text-[0.8125rem] font-semibold text-[var(--btn-content)] transition hover:bg-[var(--btn-regular-bg-hover)]"
          >
            ‹ 返回全部专题
          </Link>
        </div>
      </section>

      <section className="space-y-4">
        {guide.posts.map((guidePost, index) => (
          <article key={guidePost.id} className="grid gap-3 md:grid-cols-[2.75rem_minmax(0,1fr)] md:items-start">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--btn-regular-bg)] font-mono text-xs font-bold tabular-nums text-[var(--btn-content)]">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0 space-y-2.5">
              {guidePost.note ? (
                <p className="rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_58%,var(--card-bg)_42%)] px-3.5 py-2.5 text-sm leading-6 text-[var(--text-body)]">
                  {guidePost.note}
                </p>
              ) : null}
              <PostCard post={guidePost.post} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
