"use client";

import NextLink from "next/link";
import { useSession } from "next-auth/react";
import { ArrowRight, Github, Link2, Mail } from "lucide-react";
import useSWR from "swr";
import { PopularPostsWidget, type PopularPost } from "@/components/blog/PopularPostsWidget";
import { FallbackImage } from "@/components/ui";
import { apiFetcher } from "@/lib/client-api";
import { PUBLIC_PROFILE_FALLBACK, type PublicProfile, type PublicProfileLinkKind } from "@/lib/public-profile-data";
import type { UserReadingStats } from "@/lib/reading-stats";

const linkIcons: Record<PublicProfileLinkKind, typeof Github> = {
  email: Mail,
  github: Github,
  link: Link2,
  twitter: Link2,
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  _count?: { posts?: number };
};

type TagItem = {
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

const emptyCategoriesResponse: ApiListResponse<CategoryItem> = { success: true, data: [] };
const emptyTagsResponse: ApiListResponse<TagItem> = { success: true, data: [] };
const emptyPopularPostsResponse: ApiListResponse<PopularPost> = { success: true, data: [] };
const emptyReadingStatsResponse: ReadingStatsResponse = { success: true, data: null };

function SidebarCategorySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-1.5" data-testid="sidebar-categories-skeleton">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="flex h-8.5 items-center justify-between gap-3 px-1" key={index}>
          <span className="h-3.5 w-24 rounded-md reader-skeleton" />
          <span className="h-5 w-7 shrink-0 rounded-md reader-skeleton" />
        </div>
      ))}
    </div>
  );
}

function SidebarTagsSkeleton() {
  return (
    <div aria-hidden="true" className="flex max-h-[7rem] flex-wrap gap-1.5 overflow-hidden pb-2" data-testid="sidebar-tags-skeleton">
      {Array.from({ length: 10 }).map((_, index) => (
        <span
          className="h-[1.35rem] rounded-md reader-skeleton"
          key={index}
          style={{ width: `${2.5 + (index % 4) * 0.65}rem` }}
        />
      ))}
    </div>
  );
}

function formatReadingTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

export function Sidebar({
  profile = PUBLIC_PROFILE_FALLBACK,
  readingStats: initialReadingStats = null,
}: {
  profile?: PublicProfile;
  readingStats?: UserReadingStats | null;
}) {
  const { status } = useSession();
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useSWR<ApiListResponse<CategoryItem>>("/api/categories", apiFetcher, {
    fallbackData: emptyCategoriesResponse,
  });
  const { data: tagsResponse, isLoading: isTagsLoading } = useSWR<ApiListResponse<TagItem>>("/api/tags", apiFetcher, {
    fallbackData: emptyTagsResponse,
  });
  const { data: popularPostsResponse, isLoading: isPopularPostsLoading } = useSWR<ApiListResponse<PopularPost>>(
    "/api/posts/popular",
    apiFetcher,
    {
      fallbackData: emptyPopularPostsResponse,
    },
  );
  const readingStatsKey = !initialReadingStats && status === "authenticated" ? "/api/users/me/reading-stats" : null;
  const { data: readingStatsResponse } = useSWR<ReadingStatsResponse>(readingStatsKey, apiFetcher, {
    fallbackData: emptyReadingStatsResponse,
  });

  const categories = Array.isArray(categoriesResponse?.data) ? categoriesResponse.data : [];
  const tags = Array.isArray(tagsResponse?.data) ? tagsResponse.data : [];
  const popularPosts = Array.isArray(popularPostsResponse?.data) ? popularPostsResponse.data : [];
  const readingStats = initialReadingStats ?? readingStatsResponse?.data ?? null;
  const isTaxonomyLoading = isCategoriesLoading || isTagsLoading;
  const topCategories = categories.slice(0, 4);
  const topTags = tags.slice(0, 10);
  const displayedReadingStats = status === "unauthenticated" && !initialReadingStats ? null : readingStats;

  return (
    <aside id="sidebar" className="onload-animation h-full w-full">
      <div
        data-testid="sidebar-taxonomy-rail"
        className="reader-scrollbar-hidden sticky space-y-3.5 overflow-y-auto pr-1 transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform]"
        style={{
          top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
          maxHeight: "calc(100vh - var(--sidebar-sticky-top, 0px) - 1.75rem)",
        }}
      >
        <section aria-label="作者资料" className="reader-panel reader-panel--floating p-4 text-center">
          <div className="mx-auto mb-2.5 flex h-[5.125rem] w-[5.125rem] items-center justify-center overflow-hidden rounded-2xl bg-[var(--reader-panel-muted)] text-lg font-bold text-[var(--foreground)] ring-1 ring-[var(--reader-border)]">
            {profile.avatar ? (
              <FallbackImage
                alt={profile.name}
                className="h-full w-full rounded-2xl object-cover"
                height={82}
                loading="eager"
                src={profile.avatar}
                width={82}
              />
            ) : (
              profile.initials
            )}
          </div>

          <h2 className="text-[1.0625rem] font-bold leading-snug text-[var(--foreground)]">{profile.name}</h2>
          <div aria-hidden="true" className="mx-auto my-2 h-1 w-5 rounded-full bg-[var(--brand)]" />
          <p className="mx-auto line-clamp-3 px-1 text-xs leading-relaxed text-[var(--text-muted)]">{profile.bio}</p>

          {profile.links.length > 0 ? (
            <div className="mt-3 flex justify-center gap-2">
              {profile.links.map((link) => {
                const Icon = linkIcons[link.kind];
                return (
                  <a
                    key={link.name}
                    aria-label={link.name}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-[var(--btn-content)] transition-colors hover:bg-[var(--btn-regular-bg-hover)]"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          ) : null}
        </section>

        <section aria-busy={isTaxonomyLoading} className="reader-panel px-4 py-3.5" aria-labelledby="sidebar-categories-title">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3.5 w-[3.5px] shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
              <h3 id="sidebar-categories-title" className="text-sm font-bold text-[var(--foreground)]">
                分类
              </h3>
            </div>
            <NextLink
              aria-label="查看更多分类"
              className="reader-link inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold"
              href="/categories"
            >
              更多分类
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </NextLink>
          </div>

          {isTaxonomyLoading ? (
            <SidebarCategorySkeleton />
          ) : topCategories.length > 0 ? (
            <div className="space-y-0.5">
              {topCategories.map((category) => (
                <NextLink
                  key={category.id}
                  className="group -mx-2 flex h-8.5 items-center justify-between gap-3 rounded-lg px-2 text-[0.8125rem] text-[var(--text-body)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)]"
                  href={`/categories/${category.slug}`}
                >
                  <span className="truncate font-medium transition-colors group-hover:text-[var(--btn-content)]">
                    {category.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-[var(--btn-regular-bg)] px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold tabular-nums text-[var(--btn-content)]">
                    {category._count?.posts ?? 0}
                  </span>
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--reader-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
              分类还在整理中。
            </p>
          )}
        </section>

        <section aria-busy={isTaxonomyLoading} className="reader-panel px-4 py-3.5" aria-labelledby="sidebar-tags-title">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3.5 w-[3.5px] shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
              <h3 id="sidebar-tags-title" className="text-sm font-bold text-[var(--foreground)]">
                标签
              </h3>
            </div>
            <NextLink
              aria-label="查看更多标签"
              className="reader-link inline-flex shrink-0 items-center gap-0.5 text-xs font-semibold"
              href="/tags"
            >
              更多标签
              <ArrowRight aria-hidden="true" className="h-3 w-3" />
            </NextLink>
          </div>

          {isTaxonomyLoading ? (
            <SidebarTagsSkeleton />
          ) : topTags.length > 0 ? (
            <div className="flex max-h-[7rem] flex-wrap gap-1.5 overflow-hidden pb-2" data-testid="sidebar-tags-list">
              {topTags.map((tag) => (
                <NextLink
                  key={tag.id}
                  className="reader-chip whitespace-nowrap rounded-md px-2 py-1 text-[0.72rem]"
                  href={`/tags/${tag.slug}`}
                >
                  {tag.name}
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-[var(--reader-panel-muted)] px-3 py-2 text-xs leading-5 text-[var(--text-muted)]">
              标签还在整理中。
            </p>
          )}
        </section>

        <PopularPostsWidget isLoading={isPopularPostsLoading} posts={popularPosts} />

        {displayedReadingStats ? (
          <>
            <section className="reader-panel px-4 py-3.5" aria-labelledby="sidebar-reading-stats-title">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-3.5 w-[3.5px] shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                <h3 id="sidebar-reading-stats-title" className="text-sm font-bold text-[var(--foreground)]">
                  阅读统计
                </h3>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--reader-border)] text-center tabular-nums">
                <div>
                  <p className="text-[0.6875rem] text-[var(--text-muted)]">文章数</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[var(--foreground)]">{displayedReadingStats.totalArticles}</p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-[var(--text-muted)]">阅读时长</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[var(--foreground)]">
                    {formatReadingTime(displayedReadingStats.totalReadingMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-[0.6875rem] text-[var(--text-muted)]">连续阅读</p>
                  <p className="mt-0.5 font-mono text-lg font-bold text-[var(--foreground)]">{displayedReadingStats.streakDays}天</p>
                </div>
              </div>
            </section>

            <section className="reader-panel px-4 py-3.5" aria-labelledby="sidebar-monthly-goal-title">
              <div className="mb-2.5 flex items-center gap-2">
                <span className="h-3.5 w-[3.5px] shrink-0 rounded-full bg-[var(--brand)]" aria-hidden="true" />
                <h3 id="sidebar-monthly-goal-title" className="text-sm font-bold text-[var(--foreground)]">
                  本月阅读目标
                </h3>
              </div>

              <div className="flex items-baseline justify-between gap-4">
                <p className="font-mono text-lg font-bold tabular-nums text-[var(--foreground)]">
                  {displayedReadingStats.monthlyRead}
                  <span className="font-sans text-xs font-medium text-[var(--text-muted)]">
                    {" "}
                    / {displayedReadingStats.monthlyGoal} 篇
                  </span>
                </p>
                <span className="font-mono text-xs font-semibold tabular-nums text-[var(--brand)]">
                  {displayedReadingStats.monthlyProgress}%
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[var(--btn-regular-bg)]">
                <div
                  className="h-full rounded-full bg-[var(--brand)]"
                  style={{ width: `${displayedReadingStats.monthlyProgress}%` }}
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}
