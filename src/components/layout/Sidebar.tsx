"use client";

import NextLink from "next/link";
import { BarChart3, Folder, Github, Link2, Mail, Target } from "lucide-react";
import { useEffect, useState } from "react";

const profile = {
  name: "My Blog",
  initials: "MB",
  subtitle: "专注前端开发与工程实践",
  bio: "记录在前端、工程化与技术体系建设过程中的思考与实践。",
  links: [
    { name: "GitHub", url: "https://github.com/RoyDust", icon: Github },
    { name: "Link", url: "https://roydust.top", icon: Link2 },
    { name: "Email", url: "mailto:roydust@foxmail.com", icon: Mail },
  ],
};

type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  _count?: { posts?: number };
};

const categoryDotColors = ["var(--accent-warm)", "var(--accent-warm)", "var(--accent-warm)", "var(--text-faint)", "var(--text-faint)", "var(--accent-cyan)"];

export function Sidebar() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTaxonomy = async () => {
      try {
        const categoriesRes = await fetch("/api/categories");
        const categoriesJson = await categoriesRes.json();

        if (!isMounted) return;

        setCategories(Array.isArray(categoriesJson?.data) ? categoriesJson.data : []);
      } catch {
        if (!isMounted) return;
        setCategories([]);
      }
    };

    void loadTaxonomy();

    return () => {
      isMounted = false;
    };
  }, []);

  const topCategories = categories.slice(0, 6);
  const totalCategoryPosts = categories.reduce((sum, category) => sum + (category._count?.posts ?? 0), 0);
  const estimatedHours = Math.max(1, Math.round(totalCategoryPosts * 0.5));
  const monthlyGoal = 30;
  const monthlyRead = Math.min(monthlyGoal, Math.max(18, Math.round(totalCategoryPosts * 0.28)));
  const monthlyProgress = Math.round((monthlyRead / monthlyGoal) * 100);

  return (
    <aside id="sidebar" className="onload-animation h-full w-full">
      <div
        data-testid="sidebar-taxonomy-rail"
        className="sticky space-y-3 overflow-y-auto pr-1 transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform]"
        style={{
          top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)",
          maxHeight: "calc(100vh - var(--sidebar-sticky-top, 0px) - 1.75rem)",
        }}
      >
        <section aria-label="作者资料" className="reader-panel min-h-[var(--sidebar-profile-card-height)] p-5">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--reader-border-strong)] bg-[color:color-mix(in_oklab,var(--accent-sky)_18%,var(--reader-panel-elevated))] text-xl font-bold text-[var(--foreground)] shadow-[var(--reader-shadow)]">
            {profile.initials}
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--foreground)]">{profile.name}</h2>
              <p className="mt-1 text-sm font-medium text-[var(--text-body)]">{profile.subtitle}</p>
            </div>

            <p className="text-sm leading-7 text-[var(--text-muted)]">{profile.bio}</p>

            <div className="flex gap-2 pt-1">
              {profile.links.map((link) => {
                const Icon = link.icon;
                return (
                  <a
                    key={link.name}
                    aria-label={link.name}
                    className="reader-icon-btn h-9 w-9"
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

        <section className="reader-panel p-5" aria-labelledby="sidebar-categories-title">
          <div className="mb-3 flex items-center gap-2">
            <Folder className="h-5 w-5 text-[var(--text-body)]" aria-hidden="true" />
            <h3 id="sidebar-categories-title" className="font-bold text-[var(--foreground)]">
              分类
            </h3>
          </div>

          {topCategories.length > 0 ? (
            <div className="space-y-1.5">
              {topCategories.map((category, index) => (
                <NextLink
                  key={category.id}
                  className="group flex items-center justify-between gap-3 rounded-xl px-1.5 py-1.5 text-sm transition hover:bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_68%,transparent)]"
                  href={`/categories/${category.slug}`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: categoryDotColors[index % categoryDotColors.length] }}
                    />
                    <span className="truncate text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">{category.name}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--text-muted)]">{category._count?.posts ?? 0}</span>
                </NextLink>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--reader-border)] p-3 text-sm leading-6 text-[var(--text-body)]">
              分类还在整理中。
            </p>
          )}
        </section>

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
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{totalCategoryPosts}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">阅读时长</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{estimatedHours}h</p>
            </div>
            <div>
              <p className="text-xs text-[var(--text-muted)]">连续阅读</p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">12天</p>
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
              {monthlyRead}
              <span className="text-base font-medium text-[var(--text-muted)]"> / {monthlyGoal} 篇</span>
            </p>
            <span className="text-xs font-semibold text-[var(--text-muted)]">{monthlyProgress}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--foreground)_10%,transparent)]">
            <div
              className="h-full rounded-full bg-[color:color-mix(in_oklab,var(--accent-warm)_82%,var(--accent-sky)_18%)]"
              style={{ width: `${monthlyProgress}%` }}
            />
          </div>
        </section>
      </div>
    </aside>
  );
}
