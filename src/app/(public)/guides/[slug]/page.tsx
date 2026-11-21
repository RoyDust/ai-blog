export const revalidate = 300;

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmptyState, SectionHeading, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { GuidePostRow, TaxonomyHero } from "@/components/taxonomy";
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
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <TaxonomyHero
        eyebrow="专题"
        title={guide.title}
        description={guide.description || "这个专题按推荐阅读顺序组织文章，帮助你从入口进入主题并逐步建立完整上下文。"}
        meta={`${guide.posts.length} 篇精选文章`}
        links={[{ href: "/guides", label: "全部专题" }]}
      />

      <section aria-labelledby="guide-posts-title" className="space-y-1">
        <SectionHeading aside={<span>按推荐顺序</span>} count={guide.posts.length} id="guide-posts-title" title="阅读顺序" />
        {guide.posts.length > 0 ? (
          <StaggerList as="ol">
            {guide.posts.map((guidePost, index) => (
              <StaggerItem key={guidePost.id} as="li">
                <GuidePostRow index={index + 1} note={guidePost.note} post={guidePost.post} />
              </StaggerItem>
            ))}
          </StaggerList>
        ) : (
          <EmptyState
            title="这个专题还没有已发布的文章"
            actions={
              <>
                <TextLink href="/guides">全部专题</TextLink>
                <TextLink href="/posts">浏览全部文章</TextLink>
              </>
            }
          />
        )}
      </section>
    </>
  );
}
