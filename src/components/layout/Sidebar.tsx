"use client";

import NextLink from "next/link";
import { ArrowRight, BarChart3, Folder, Github, Link2, Mail, Tags, Target } from "lucide-react";
import { useEffect, useState } from "react";
import { PopularPostsWidget, type PopularPost } from "@/components/blog/PopularPostsWidget";
import { FallbackImage } from "@/components/ui";
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

const categoryDotColors = ["var(--accent-warm)", "var(--accent-warm)", "var(--accent-warm)", "var(--text-faint)", "var(--text-faint)", "var(--accent-cyan)"];

function formatReadingTime(minutes: number) {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.round(minutes / 60)}h`;
}

export function Sidebar({
  profile = PUBLIC_PROFILE_FALLBACK,
  readingStats,
}: {
  profile?: PublicProfile;
  readingStats?: UserReadingStats | null;
}) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [popularPosts, setPopularPosts] = useState<PopularPost[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTaxonomy = async () => {
      const readApiJson = async (url: string) => {
        try {
          const response = await fetch(url);
          return await response.json();
        } catch {
          return null;
        }
      };

      const [categoriesJson, tagsJson, popularJson] = await Promise.all([
        readApiJson("/api/categories"),
        readApiJson("/api/tags"),
        readApiJson("/api/posts/popular"),
      ]);

      if (!isMounted) return;

      setCategories(Array.isArray(categoriesJson?.data) ? categoriesJson.data : []);
      setTags(Array.isArray(tagsJson?.data) ? tagsJson.data : []);
      setPopularPosts(Array.isArray(popularJson?.data) ? popularJson.data : []);
    };

    void loadTaxonomy();

    return () => {
      isMounted = false;
    };
  }, []);

  const topCategories = categories.slice(0, 6);
  const topTags = tags.slice(0, 10);

  return (
    <aside id="sidebar" className="onload-animation w-full">
      <div
        data-testid="sidebar-taxonomy-rail"
        className="sticky space-y-3 pr-1 transition-[top,transform,box-shadow] duration-300 ease-out will-change-[top,transform]"
        style={{
          top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
        }}
      >
        <section aria-label="作者资料" className="reader-panel p-4 text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--reader-border-strong)] bg-[color:color-mix(in_oklab,var(--accent-sky)_18%,var(--reader-panel-elevated))] text-xl font-bold text-[var(--foreground)] shadow-[var(--reader-shadow)]">
            {profile.avatar ? (
              <FallbackImage alt={profile.name} className="rounded-full object-cover" height={80} src={profile.avatar} width={80} />
            ) : (
              profile.initials
            )}
          </div>

          <div className="space-y-2.5">
            <div>
              <h2 className="text-xl font-extrabold text-[var(--foreground)]">{profile.name}</h2>
              <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-body)]">{profile.subtitle}</p>
            </div>

            <p className="mx-auto max-w-[11rem] text-xs leading-6 text-[var(--text-muted)]">{profile.bio}</p>

            <div className="flex justify-center gap-2 pt-1">
              {profile.links.map((link) => {
                const Icon = linkIcons[link.kind];
                return (
                  <a
                    key={link.name}
                    aria-label={link.name}
                    className="reader-icon-btn h-8 w-8"
                    href={link.url}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section className="reader-panel p-4" aria-labelledby="sidebar-categories-title">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-[var(--accent-sky)]" aria-hidden="true" />
            <Folder className="h-4 w-4 text-[var(--text-body)]" aria-hidden="true" />
            <h3 id="sidebar-categories-title" className="font-bold text-[var(--foreground)]">
              分类
            </h3>
          </div>

          {topCategories.length > 0 ? (
            <div className="space-y-1.5">
              {topCategories.map((category, index) => (
                <NextLink
                  key={category.id}
                  className="group flex items-center justify-between gap-3 rounded-lg px-1.5 py-1.5 text-sm transition hover:bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_68%,transparent)]"
                  href={`/categories/${category.slug}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: categoryDotColors[index % categoryDotColors.length] }}
                    />
                    <span className="truncate text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">{category.name}</span>
                  </span>
                  <span className="shrink-0 rounded-md bg-[color:color-mix(in_oklab,var(--accent-sky)_72%,white_8%)] px-2 py-0.5 text-xs font-bold text-[#06101a]">{category._count?.posts ?? 0}</span>
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--reader-border)] p-3 text-sm leading-6 text-[var(--text-body)]">
              分类还在整理中。
            </p>
          )}
        </section>

        <section className="reader-panel p-4" aria-labelledby="sidebar-tags-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-4 w-1 rounded-full bg-[var(--accent-sky)]" aria-hidden="true" />
              <Tags className="h-4 w-4 text-[var(--text-body)]" aria-hidden="true" />
              <h3 id="sidebar-tags-title" className="font-bold text-[var(--foreground)]">
                标签
              </h3>
            </div>
            <NextLink
              aria-label="查看更多标签"
              className="reader-link inline-flex shrink-0 items-center gap-1 text-xs font-bold"
              href="/tags"
            >
              更多标签
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </NextLink>
          </div>

          {topTags.length > 0 ? (
            <div className="flex max-h-[6.5rem] flex-wrap gap-2 overflow-hidden" data-testid="sidebar-tags-list">
              {topTags.map((tag) => (
                <NextLink
                  key={tag.id}
                  className="reader-chip whitespace-nowrap rounded-md px-2 py-1 text-[0.7rem]"
                  href={`/tags/${tag.slug}`}
                  style={tag.color ? { borderColor: tag.color } : undefined}
                >
                  {tag.name}
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--reader-border)] p-3 text-sm leading-6 text-[var(--text-body)]">
              标签还在整理中。
            </p>
          )}
        </section>

        <PopularPostsWidget posts={popularPosts} />

        {readingStats ? (
          <>
            <section className="reader-panel p-5" aria-labelledby="sidebar-reading-stats-title">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[var(--accent-cyan)]" aria-hidden="true" />
                <h3 id="sidebar-reading-stats-title" className="font-bold text-[var(--foreground)]">
                  阅读统计
                </h3>
              </div>

              <div className="grid grid-cols-3 divide-x divide-[var(--reader-border)] text-center">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">文章数</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{readingStats.totalArticles}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">阅读时长</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                    {formatReadingTime(readingStats.totalReadingMinutes)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)]">连续阅读</p>
                  <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{readingStats.streakDays}天</p>
                </div>
              </div>
            </section>

            <section className="reader-panel p-5" aria-labelledby="sidebar-monthly-goal-title">
              <div className="mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-[var(--accent-warm)]" aria-hidden="true" />
                <h3 id="sidebar-monthly-goal-title" className="text-sm font-medium text-[var(--text-body)]">
                  本月阅读目标
                </h3>
              </div>

              <div className="flex items-end justify-between gap-4">
                <p className="text-2xl font-bold text-[var(--foreground)]">
                  {readingStats.monthlyRead}
                  <span className="text-base font-medium text-[var(--text-muted)]">
                    {" "}
                    / {readingStats.monthlyGoal} 篇
                  </span>
                </p>
                <span className="text-xs font-semibold text-[var(--text-muted)]">{readingStats.monthlyProgress}%</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]">
                <div
                  className="h-full rounded-full bg-[color:color-mix(in_oklab,var(--accent-warm)_82%,var(--accent-sky)_18%)]"
                  style={{ width: `${readingStats.monthlyProgress}%` }}
                />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}
