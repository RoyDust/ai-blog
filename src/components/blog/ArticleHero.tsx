"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { editorialEase } from "@/components/editorial";
import { FallbackImage } from "@/components/ui";
import { formatIsoDate } from "@/lib/editorial-format";
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

const numberFormatter = new Intl.NumberFormat("en-US");

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: editorialEase } },
};

const staticVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

/**
 * 文章 Hero（简报 16.4）：面包屑在 Hero 上方；有封面时文字压在封面下半区，
 * 只叠一层自下而上的暗渐变；无封面时直接排在纸面上，下方 2px 粗线收尾。
 *
 * 封面与 h1 带 viewTransitionName，跨页 morph 期间不能再叠加变换，
 * 因此入场只作用于分类、摘要与 meta 行，h1 保持静态。
 */
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
  const reduce = useReducedMotion();
  const item = reduce ? staticVariants : itemVariants;
  const authorName = author.name ?? "匿名作者";
  const hasCover = Boolean(coverImage);

  return (
    <div className="space-y-3">
      <nav aria-label="Breadcrumb" className="article-breadcrumb">
        <Link href="/">首页</Link>
        <span aria-hidden="true">/</span>
        <Link href="/posts">文章</Link>
        <span aria-hidden="true">/</span>
        {category ? (
          <>
            <Link href={`/categories/${category.slug}`}>{category.name}</Link>
            <span aria-hidden="true">/</span>
          </>
        ) : null}
        <span aria-current="page" className="article-breadcrumb__current">
          {title}
        </span>
      </nav>

      <header
        className={hasCover ? "article-hero article-hero--cover" : "article-hero article-hero--plain"}
        data-variant={hasCover ? "cover" : "plain"}
        style={hasCover ? { viewTransitionName: getPostViewTransitionName("cover", slug) } : undefined}
      >
        {hasCover && coverImage ? (
          <>
            <div aria-hidden="true" className="article-hero__media absolute inset-0">
              <FallbackImage
                alt=""
                className="object-cover"
                fill
                priority
                sizes="(min-width: 1280px) 672px, 100vw"
                src={coverImage}
              />
            </div>
            <div aria-hidden="true" className="article-hero__veil" />
          </>
        ) : null}

        <motion.div
          className="article-hero__body"
          variants={containerVariants}
          initial={reduce ? false : "hidden"}
          animate="visible"
        >
          {category ? (
            <motion.div variants={item}>
              <Link className="article-hero__category" href={`/categories/${category.slug}`}>
                {category.name}
              </Link>
            </motion.div>
          ) : null}

          <h1
            className="article-hero__title"
            style={{ viewTransitionName: getPostViewTransitionName("title", slug) }}
          >
            {title}
          </h1>

          {excerpt ? (
            <motion.p className="article-hero__excerpt" variants={item}>
              {excerpt}
            </motion.p>
          ) : null}

          <motion.div className="article-hero__meta" data-testid="article-hero-meta" variants={item}>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="article-hero__avatar">
                {author.image ? (
                  <FallbackImage alt="" className="h-full w-full object-cover" height={24} src={author.image} width={24} />
                ) : (
                  authorName.slice(0, 1)
                )}
              </span>
              <span className="article-hero__author">{authorName}</span>
            </span>
            <span aria-hidden="true">·</span>
            <time className="ed-mono" dateTime={new Date(createdAt).toISOString()}>
              {formatIsoDate(createdAt)}
            </time>
            <span aria-hidden="true">·</span>
            <span>
              <span className="ed-mono">{numberFormatter.format(viewCount)}</span> 阅读
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="ed-mono">{readingTimeMinutes}</span> 分钟
            </span>
          </motion.div>
        </motion.div>
      </header>

      {hasCover ? null : <hr className="ed-rule-strong" />}
    </div>
  );
}
