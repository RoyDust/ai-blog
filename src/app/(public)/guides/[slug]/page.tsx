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
      <section className="reader-banner onload-animation px-6 py-8 md:px-8 md:py-10">
        <div className="relative z-10 flex min-h-[calc(var(--reader-banner-height)-4rem)] flex-col justify-end gap-6">
          <span className="reader-chip w-fit">专题</span>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-90 text-4xl font-black leading-tight md:text-5xl">{guide.title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base">
              {guide.description || "这个专题按推荐阅读顺序组织文章，帮助你从入口进入主题并逐步建立完整上下文。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="reader-panel rounded-2xl px-4 py-3 text-sm font-medium text-[var(--foreground)]">
              {guide.posts.length} 篇精选文章
            </span>
            <Link href="/guides" className="reader-link text-sm font-semibold">
              返回全部专题
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        {guide.posts.map((guidePost, index) => (
          <article key={guidePost.id} className="grid gap-3 md:grid-cols-[3.5rem_minmax(0,1fr)]">
            <div className="reader-panel flex h-12 w-12 items-center justify-center rounded-2xl text-sm font-black text-[var(--foreground)]">
              {index + 1}
            </div>
            <div className="space-y-3">
              {guidePost.note ? (
                <p className="reader-panel rounded-2xl px-4 py-3 text-sm leading-6 text-[var(--text-body)]">{guidePost.note}</p>
              ) : null}
              <PostCard post={guidePost.post} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
