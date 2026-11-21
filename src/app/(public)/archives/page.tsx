export const revalidate = 300;

import type { Metadata } from "next";
import { ArchivesTimelineClient } from "@/components/blog/ArchivesTimelineClient";
import { TaxonomyHero } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings();

  return buildPageMetadata({
    title: "文章归档",
    description: "按发布时间倒序浏览全部已发布文章。",
    path: "/archives",
    siteUrl: settings.siteUrl,
  });
}

async function getArchivePosts() {
  try {
    return await prisma.post.findMany({
      where: { published: true, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        createdAt: true,
        generatedByAiNews: true,
        category: { select: { name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  } catch (error) {
    console.error("Load archive posts error:", error);
    return [];
  }
}

export default async function ArchivesPage() {
  const posts = await getArchivePosts();
  const years = new Set(posts.map((post) => new Date(post.createdAt).getFullYear().toString()));

  return (
    <div className="reader-section">
      <TaxonomyHero
        eyebrow="时间归档"
        title="文章归档"
        description="按年份与发布日期倒序收纳全部文章，方便回溯每一次排障与技术记录。"
        countLabel={`${posts.length} 篇文章 · ${years.size} 个年份`}
        primaryHref="/posts"
        primaryLabel="全部文章"
        secondaryHref="/categories"
        secondaryLabel="分类专题"
      />

      {posts.length === 0 ? (
        <div className="reader-panel p-8 text-sm text-[var(--text-muted)]">暂无已发布文章。</div>
      ) : (
        <ArchivesTimelineClient posts={posts} />
      )}
    </div>
  );
}
