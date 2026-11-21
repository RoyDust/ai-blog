"use client";

import Link from "next/link";
import { CalendarDays, Clock3, Eye, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { listContainerVariants, revealVariants } from "@/components/motion/variants";
import { FallbackImage } from "@/components/ui";
import { getPostViewTransitionName } from "@/lib/view-transition";

interface ArticleHeroProps {
  slug: string;
  title: string;
  excerpt: string | null;
  coverImage?: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string | null; image?: string | null };
  createdAt: Date | string;
  viewCount: number;
  readingTimeMinutes: number;
}

export function ArticleHero({
  slug,
  title,
  excerpt,
  coverImage,
  category,
  author,
  createdAt,
  viewCount,
  readingTimeMinutes,
}: ArticleHeroProps) {
  // 封面与 h1 带 viewTransitionName，跨页 morph 期间不能再叠加变换，
  // 因此 header 与标题链保持静态，级联只作用于面包屑/章节/摘要/meta；
  // reduced-motion 由 BlogMotionProvider 的 MotionConfig 全局处理
  const containerVariants = listContainerVariants;
  const itemVariants = revealVariants;

  const formattedDate = new Date(createdAt).toLocaleDateString("zh-CN");

  return (
    <header
      className="reader-banner !min-h-0 !rounded-none !border-0 !bg-none !shadow-none before:!hidden px-5 pt-6 pb-2 sm:px-7 lg:px-9 lg:pt-8"
      style={!coverImage ? { viewTransitionName: getPostViewTransitionName("cover", slug) } : undefined}
    >
      <motion.div
        className="mx-auto grid w-full max-w-[var(--article-reading-max-width)] gap-3.5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.nav
          aria-label="Breadcrumb"
          className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]"
          variants={itemVariants}
        >
          <Link className="transition-colors hover:text-[var(--brand)]" href="/">
            首页
          </Link>
          <span aria-hidden="true">/</span>
          <Link className="transition-colors hover:text-[var(--brand)]" href="/posts">
            文章
          </Link>
          <span aria-hidden="true">/</span>
          {category ? (
            <>
              <Link className="transition-colors hover:text-[var(--brand)]" href={`/categories/${category.slug}`}>
                {category.name}
              </Link>
              <span aria-hidden="true">/</span>
            </>
          ) : null}
          <span className="min-w-0 truncate text-[var(--text-faint)]">{title}</span>
        </motion.nav>

        <motion.div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-muted)]"
          variants={itemVariants}
        >
          <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
            <CalendarDays className="h-3.5 w-3.5 text-[var(--brand)]" aria-hidden="true" />
            {formattedDate}
          </span>
          {category ? (
            <>
              <span aria-hidden="true" className="text-[var(--text-faint)]">·</span>
              <Link
                className="font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)]"
                href={`/categories/${category.slug}`}
              >
                {category.name}
              </Link>
            </>
          ) : null}
          <span aria-hidden="true" className="text-[var(--text-faint)]">·</span>
          <span className="inline-flex items-center gap-1.5">
            {author.image ? (
              <FallbackImage alt={author.name ?? "作者头像"} className="rounded-md object-cover" height={18} src={author.image} width={18} />
            ) : (
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {author.name ?? "匿名作者"}
          </span>
          <span aria-hidden="true" className="text-[var(--text-faint)]">·</span>
          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {viewCount} 阅读
          </span>
          <span aria-hidden="true" className="text-[var(--text-faint)]">·</span>
          <span className="inline-flex items-center gap-1 font-mono tabular-nums">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            预计阅读 {readingTimeMinutes} 分钟
          </span>
        </motion.div>

        <h1
          className="font-display text-[clamp(1.375rem,2.6vw,1.875rem)] font-bold leading-[1.35] tracking-tight text-[var(--foreground)]"
          style={{ viewTransitionName: getPostViewTransitionName("title", slug) }}
        >
          {title}
        </h1>

        {coverImage ? (
          <div
            className="theme-media relative mt-1 aspect-[2.15/1] w-full overflow-hidden rounded-2xl"
            style={{ viewTransitionName: getPostViewTransitionName("cover", slug) }}
          >
            <FallbackImage
              alt={title}
              className="theme-media-image object-cover"
              fill
              priority
              sizes="(min-width: 1280px) 860px, 100vw"
              src={coverImage}
            />
          </div>
        ) : null}

        {excerpt ? (
          <motion.div
            className="mt-1 rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_58%,var(--card-bg)_42%)] px-4 py-3 text-[13.5px] leading-6 text-[var(--text-body)]"
            variants={itemVariants}
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-[var(--brand)]">
              <span>本文提要</span>
              <span className="font-mono text-[11px] font-medium text-[var(--text-muted)]">TL;DR</span>
            </div>
            <p className="text-[var(--text-body)]">{excerpt}</p>
          </motion.div>
        ) : null}
      </motion.div>
    </header>
  );
}
