export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Reveal, SectionHeading, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
import { TaxonomyHero } from "@/components/taxonomy";
import { getBlogSettings } from "@/lib/blog-settings";
import { formatIsoDate, formatMonthDay, formatYear } from "@/lib/editorial-format";
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

type ArchivePost = Awaited<ReturnType<typeof getArchivePosts>>[number];

export default async function ArchivesPage() {
  const posts = await getArchivePosts();

  const groups = new Map<string, ArchivePost[]>();
  for (const post of posts) {
    const year = formatYear(post.createdAt);
    const yearPosts = groups.get(year) ?? [];
    yearPosts.push(post);
    groups.set(year, yearPosts);
  }

  return (
    <>
      <TaxonomyHero
        eyebrow="归档"
        title="文章归档"
        description="把所有已发布文章收进一条安静的时间线。适合回看长期积累，也适合从某个年份重新进入一段技术记录。"
        meta={`${posts.length} 篇文章 · ${groups.size} 个年份`}
        links={[
          { href: "/posts", label: "浏览全部文章" },
          { href: "/categories", label: "查看分类专题" },
        ]}
      />

      {posts.length === 0 ? (
        <EmptyState title="暂无已发布文章" actions={<TextLink href="/">回到首页</TextLink>} />
      ) : (
        [...groups.entries()].map(([year, yearPosts]) => (
          <Reveal key={year} as="section" aria-labelledby={`archive-year-${year}`} className="space-y-1">
            <SectionHeading count={yearPosts.length} id={`archive-year-${year}`} title={year} />
            <StaggerList inView as="ol" stagger={0.035}>
              {yearPosts.map((post) => (
                <StaggerItem key={post.id} as="li">
                  <ArchiveRow post={post} />
                </StaggerItem>
              ))}
            </StaggerList>
          </Reveal>
        ))
      )}
    </>
  );
}

/**
 * 归档行（README 第 11 节）：左列等宽「MM-DD」，右列衬线标题、2 行摘要、分类小字。
 * 没有缩略图列；整行可点（标题链接铺满整行），分类小字单独可点。
 */
function ArchiveRow({ post }: { post: ArchivePost }) {
  return (
    <article className="ed-row grid-cols-[3.25rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)]" data-testid="archive-row">
      <time className="ed-row__date" dateTime={formatIsoDate(post.createdAt)}>
        {formatMonthDay(post.createdAt)}
      </time>
      <div className="min-w-0">
        <h3 className="ed-row__title line-clamp-2">
          <Link className="ed-row__link" href={`/posts/${post.slug}`}>
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? <p className="ed-row__excerpt ed-row__excerpt--desktop line-clamp-2">{post.excerpt}</p> : null}
        {post.category ? (
          <p className="ed-row__meta ed-meta">
            <Link className="ed-tag text-[0.75rem]" href={`/categories/${post.category.slug}`}>
              {post.category.name}
            </Link>
          </p>
        ) : null}
      </div>
    </article>
  );
}
