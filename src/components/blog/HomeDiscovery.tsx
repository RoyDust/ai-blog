"use client";

import NextLink from "next/link";

import { DottedRow, Reveal, SectionHeading, SkeletonBar, TextLink } from "@/components/editorial";
import { useDiscoveryData } from "@/components/layout/Sidebar";
import { formatIndex } from "@/lib/editorial-format";

const columnLabelClass = "text-[0.8125rem] font-bold tracking-[0.08em] text-[var(--text-muted)]";

/**
 * 首页「发现」区：只在 xl 以下出现，补上看不到侧栏的缺口（README 第 16 节）。
 * 6 个分类两列点线目录行、热门 3 条、「全部标签 →」。
 */
export function HomeDiscovery() {
  const { categories, popularPosts, isTaxonomyLoading, isPopularPostsLoading } = useDiscoveryData();
  const topCategories = categories.slice(0, 6);
  const topPopular = popularPosts.slice(0, 3);

  if (!isTaxonomyLoading && !isPopularPostsLoading && topCategories.length === 0 && topPopular.length === 0) {
    return null;
  }

  return (
    <Reveal as="section" aria-labelledby="home-discovery-title" className="space-y-3 xl:hidden" data-testid="home-discovery">
      <SectionHeading id="home-discovery-title" title="发现" />

      <div>
        <h3 className={columnLabelClass}>分类</h3>
        {isTaxonomyLoading ? (
          <div aria-hidden="true" className="grid grid-cols-2 gap-x-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex min-h-11 items-center justify-between">
                <SkeletonBar className="h-3.5 w-16" />
                <SkeletonBar className="h-3 w-4" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-6">
            {topCategories.map((category) => (
              <DottedRow
                key={category.id}
                className="text-[0.9375rem]"
                count={category._count?.posts ?? 0}
                href={`/categories/${category.slug}`}
                name={category.name}
              />
            ))}
          </div>
        )}
      </div>

      {topPopular.length > 0 ? (
        <div className="border-t border-[var(--border)] pt-4">
          <h3 className={columnLabelClass}>热门</h3>
          <ol className="mt-1">
            {topPopular.map((post, index) => (
              <li key={post.id} className="border-b border-[var(--border)]">
                <NextLink
                  className="flex min-h-11 items-center gap-3 py-2 text-[0.9375rem] text-[var(--text-body)] transition-colors hover:text-[var(--foreground)]"
                  href={`/posts/${post.slug}`}
                >
                  <span className="ed-mono text-[0.8125rem] text-[var(--text-muted)]">{formatIndex(index + 1)}</span>
                  <span className="min-w-0 truncate">{post.title}</span>
                </NextLink>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <TextLink href="/tags">全部标签</TextLink>
    </Reveal>
  );
}
