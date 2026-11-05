"use client";

import { useSession } from "next-auth/react";
import { Github, Link2, Mail, Rss } from "lucide-react";
import useSWR from "swr";
import { DottedRow, SkeletonBar, TagLine, TextLink } from "@/components/editorial";
import { PopularPostsWidget, type PopularPost } from "@/components/blog/PopularPostsWidget";
import { FallbackImage } from "@/components/ui";
import { apiFetcher } from "@/lib/client-api";
import { PUBLIC_PROFILE_FALLBACK, type PublicProfile, type PublicProfileLinkKind } from "@/lib/public-profile-data";
import type { UserReadingStats } from "@/lib/reading-stats";
import { cn } from "@/lib/cn";

const linkIcons: Record<PublicProfileLinkKind, typeof Github> = {
  email: Mail,
  github: Github,
  link: Link2,
  twitter: Link2,
};

export type SidebarCategoryItem = {
  id: string;
  name: string;
  slug: string;
  _count?: { posts?: number };
};

export type SidebarTagItem = {
  id: string;
  name: string;
  slug: string;
  color?: string | null;
  _count?: { posts?: number };
};

type ApiListResponse<T> = {
  success?: boolean;
  data?: T[];
};

type ReadingStatsResponse = {
  success?: boolean;
  data?: UserReadingStats | null;
};

const emptyCategoriesResponse: ApiListResponse<SidebarCategoryItem> = { success: true, data: [] };
const emptyTagsResponse: ApiListResponse<SidebarTagItem> = { success: true, data: [] };
const emptyPopularPostsResponse: ApiListResponse<PopularPost> = { success: true, data: [] };
const emptyReadingStatsResponse: ReadingStatsResponse = { success: true, data: null };

/** 侧栏与手机「发现」区共用的公开目录数据（同 key，SWR 去重） */
export function useDiscoveryData() {
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useSWR<ApiListResponse<SidebarCategoryItem>>(
    "/api/categories",
    apiFetcher,
    { fallbackData: emptyCategoriesResponse },
  );
  const { data: tagsResponse, isLoading: isTagsLoading } = useSWR<ApiListResponse<SidebarTagItem>>("/api/tags", apiFetcher, {
    fallbackData: emptyTagsResponse,
  });
  const { data: popularPostsResponse, isLoading: isPopularPostsLoading } = useSWR<ApiListResponse<PopularPost>>(
    "/api/posts/popular",
    apiFetcher,
    { fallbackData: emptyPopularPostsResponse },
  );

  return {
    categories: Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [],
    tags: Array.isArray(tagsResponse?.data) ? tagsResponse.data : [],
    popularPosts: Array.isArray(popularPostsResponse?.data) ? popularPostsResponse.data : [],
    isTaxonomyLoading: isCategoriesLoading || isTagsLoading,
    isPopularPostsLoading,
  };
}

function SidebarCategorySkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" data-testid="sidebar-categories-skeleton">
      {Array.from({ length: count }).map((_, index) => (
        <div className="flex min-h-11 items-center justify-between gap-3" key={index}>
          <SkeletonBar className="h-3.5 w-20" />
          <SkeletonBar className="h-3 w-5" />
        </div>
      ))}
    </div>
  );
}

function SidebarTagsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-x-3 gap-y-2.5 py-1" data-testid="sidebar-tags-skeleton">
      {Array.from({ length: 10 }).map((_, index) => (
        <span key={index} style={{ width: `${2.75 + (index % 4) * 0.6}rem` }}>
          <SkeletonBar className="h-3.5 w-full" />
        </span>
      ))}
    </div>
  );
}

export function DiscoveryCategories({
  categories,
  isLoading,
  limit = 4,
  className,
  listClassName,
}: {
  categories: SidebarCategoryItem[];
  isLoading: boolean;
  limit?: number;
  className?: string;
  listClassName?: string;
}) {
  const visible = categories.slice(0, limit);

  return (
    <section aria-busy={isLoading} className={className} aria-labelledby="sidebar-categories-title">
      <h3 id="sidebar-categories-title" className="ed-serif mb-1 text-base text-[var(--foreground)]">
        分类
      </h3>
      {isLoading ? (
        <SidebarCategorySkeleton count={limit} />
      ) : visible.length > 0 ? (
        <div className={listClassName}>
          {visible.map((category) => (
            <DottedRow
              key={category.id}
              className="text-[0.875rem]"
              count={category._count?.posts ?? 0}
              href={`/categories/${category.slug}`}
              name={category.name}
            />
          ))}
        </div>
      ) : (
        <p className="py-2 text-[0.875rem] text-[var(--text-muted)]">分类还在整理中。</p>
      )}
      <TextLink aria-label="查看更多分类" className="mt-2" href="/categories">
        更多分类
      </TextLink>
    </section>
  );
}

export function DiscoveryTags({
  tags,
  isLoading,
  className,
}: {
  tags: SidebarTagItem[];
  isLoading: boolean;
  className?: string;
}) {
  const topTags = tags.slice(0, 10);

  return (
    <section aria-busy={isLoading} className={className} aria-labelledby="sidebar-tags-title">
      <h3 id="sidebar-tags-title" className="ed-serif mb-2 text-base text-[var(--foreground)]">
        标签
      </h3>
      {isLoading ? (
        <SidebarTagsSkeleton />
      ) : topTags.length > 0 ? (
        <div data-testid="sidebar-tags-list">
          <TagLine tags={topTags} />
        </div>
      ) : (
        <p className="py-2 text-[0.875rem] text-[var(--text-muted)]">标签还在整理中。</p>
      )}
      <TextLink aria-label="查看更多标签" className="mt-3" href="/tags">
        全部标签
      </TextLink>
    </section>
  );
}

function formatReadingTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

const groupClass = "border-t border-[var(--border)] pt-6";

/**
 * 侧栏（简报 15.10）：纸面左栏，组与组之间 1px 细线 + 1.5rem 留白，没有面板。
 * 顺序：资料、热门、分类、标签；登录后在末尾追加阅读统计。
 */
export function Sidebar({
  profile = PUBLIC_PROFILE_FALLBACK,
  readingStats: initialReadingStats = null,
}: {
  profile?: PublicProfile;
  readingStats?: UserReadingStats | null;
}) {
  const { status } = useSession();
  const { categories, tags, popularPosts, isTaxonomyLoading, isPopularPostsLoading } = useDiscoveryData();
  const readingStatsKey = !initialReadingStats && status === "authenticated" ? "/api/users/me/reading-stats" : null;
  const { data: readingStatsResponse } = useSWR<ReadingStatsResponse>(readingStatsKey, apiFetcher, {
    fallbackData: emptyReadingStatsResponse,
  });

  const readingStats = initialReadingStats ?? readingStatsResponse?.data ?? null;
  const displayedReadingStats = status === "unauthenticated" && !initialReadingStats ? null : readingStats;
  const socialLinks = profile.links.filter((link) => link.url);

  return (
    <aside id="sidebar" className="h-full w-full">
      <div
        data-testid="sidebar-taxonomy-rail"
        className="reader-scrollbar-hidden sticky space-y-6 overflow-y-auto pb-2 transition-[top,max-height] duration-300 ease-out"
        style={{
          top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
          maxHeight: "calc(100vh - var(--sidebar-sticky-top, 0px) - 1.75rem)",
        }}
      >
        <section aria-label="作者资料">
          <div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-alt)] text-lg font-bold text-[var(--foreground)]">
            {profile.avatar ? (
              <FallbackImage alt={profile.name} className="h-full w-full rounded-full object-cover" height={64} loading="eager" src={profile.avatar} width={64} />
            ) : (
              profile.initials
            )}
          </div>
          <h2 className="ed-serif text-[1.0625rem] text-[var(--foreground)]">{profile.name}</h2>
          <p className="mt-2 line-clamp-2 text-[0.875rem] leading-[1.7] text-[var(--text-body)]">{profile.bio}</p>
          <div className={cn("-ml-2.5 mt-3 flex gap-1", socialLinks.length === 0 && "hidden")}>
            {socialLinks.map((link) => {
              const Icon = linkIcons[link.kind];
              return (
                <a
                  key={link.name}
                  aria-label={link.name}
                  title={link.name}
                  className="ed-icon-btn"
                  href={link.url}
                  rel="noopener noreferrer"
                  target={link.kind === "email" ? undefined : "_blank"}
                >
                  <Icon aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
                </a>
              );
            })}
            <a aria-label="RSS 订阅源" title="RSS" className="ed-icon-btn" href="/rss.xml">
              <Rss aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} />
            </a>
          </div>
        </section>

        <PopularPostsWidget className={groupClass} isLoading={isPopularPostsLoading} posts={popularPosts} />

        <DiscoveryCategories categories={categories} className={groupClass} isLoading={isTaxonomyLoading} />

        <DiscoveryTags className={groupClass} isLoading={isTaxonomyLoading} tags={tags} />

        {displayedReadingStats ? (
          <section className={groupClass} aria-labelledby="sidebar-reading-stats-title">
            <h3 id="sidebar-reading-stats-title" className="ed-serif mb-3 text-base text-[var(--foreground)]">
              阅读统计
            </h3>
            <dl className="grid grid-cols-3 divide-x divide-[var(--border)]">
              <div className="pr-2">
                <dt className="text-[0.75rem] text-[var(--text-muted)]">文章数</dt>
                <dd className="ed-mono mt-1 text-lg text-[var(--foreground)]">{displayedReadingStats.totalArticles}</dd>
              </div>
              <div className="px-2">
                <dt className="text-[0.75rem] text-[var(--text-muted)]">阅读时长</dt>
                <dd className="ed-mono mt-1 text-lg text-[var(--foreground)]">{formatReadingTime(displayedReadingStats.totalReadingMinutes)}</dd>
              </div>
              <div className="pl-2">
                <dt className="text-[0.75rem] text-[var(--text-muted)]">连续阅读</dt>
                <dd className="ed-mono mt-1 text-lg text-[var(--foreground)]">
                  {displayedReadingStats.streakDays}
                  <span className="ml-0.5 font-sans text-[0.75rem] text-[var(--text-muted)]">天</span>
                </dd>
              </div>
            </dl>

            <div className="mt-5" aria-labelledby="sidebar-monthly-goal-title">
              <div className="flex items-baseline justify-between gap-3">
                <h4 id="sidebar-monthly-goal-title" className="text-[0.8125rem] font-bold text-[var(--text-body)]">
                  本月阅读目标
                </h4>
                <span className="ed-mono text-[0.75rem] text-[var(--text-muted)]">
                  {displayedReadingStats.monthlyRead} / {displayedReadingStats.monthlyGoal} 篇
                </span>
              </div>
              <div className="mt-2 h-0.5 bg-[var(--border)]">
                <div className="h-full bg-[var(--foreground)] transition-[width] duration-700 ease-out" style={{ width: `${displayedReadingStats.monthlyProgress}%` }} />
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
