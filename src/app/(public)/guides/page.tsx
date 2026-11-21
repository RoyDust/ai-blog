export const revalidate = 300;

import type { Metadata } from "next";

import { EmptyState, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { TaxonomyEntry, TaxonomyHero, TaxonomyLoadError } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { formatIsoDate } from "@/lib/editorial-format";
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
    <>
      <TaxonomyHero
        eyebrow="专题"
        title="专题导读"
        description="把分散文章整理成可连续阅读的主题路径。先读入口，再沿着上下文补齐背景、方法和案例。"
        meta={`${guides.length} 个专题 · ${totalPosts} 篇精选文章`}
      />

      {hasLoadError ? (
        <TaxonomyLoadError retryHref="/guides" title="专题导读加载失败，请稍后重试。" />
      ) : guides.length > 0 ? (
        <StaggerList inView as="ul" className="grid md:grid-cols-2 md:gap-x-8" aria-label="专题目录">
          {guides.map((guide) => (
            <StaggerItem key={guide.id} as="li">
              <TaxonomyEntry
                href={`/guides/${guide.slug}`}
                title={guide.title}
                description={guide.description}
                descriptionLines={3}
                metaPosition="top"
                meta={`${guide.posts.length} 篇 · ${formatIsoDate(guide.createdAt)}`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      ) : (
        <EmptyState
          title="当前还没有已发布的专题导读"
          actions={
            <>
              <TextLink href="/posts">浏览全部文章</TextLink>
              <TextLink href="/series">全部系列</TextLink>
            </>
          }
        />
      )}
    </>
  );
}
