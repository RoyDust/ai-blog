"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { listContainerVariants, revealVariants } from "@/components/motion/variants";

interface AiDailyItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  createdAt: Date | string;
  publishedAt?: Date | string | null;
}

interface HomeAiDailyStripProps {
  posts: AiDailyItem[];
}

function formatTime(value: Date | string | null | undefined, index: number) {
  if (!value) {
    return `${String(8 + index).padStart(2, "0")}:30`;
  }

  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function trimDailyTitle(title: string) {
  return title.replace(/^\d{4}-\d{2}-\d{2}\s*AI\s*日报[：:]\s*/, "");
}

export function HomeAiDailyStrip({ posts }: HomeAiDailyStripProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="reader-panel p-4 sm:p-5" aria-labelledby="home-ai-daily-title">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 id="home-ai-daily-title" className="reader-section-heading">
          <Sparkles className="h-5 w-5 text-[var(--accent-sky)]" aria-hidden="true" />
          AI 日报
        </h2>
        <Link href="/series/ai-daily" className="reader-link inline-flex shrink-0 items-center gap-1 text-xs font-bold">
          查看全部
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <motion.div
        className="grid gap-3 md:grid-cols-5"
        variants={listContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {posts.slice(0, 5).map((post, index) => (
          <motion.div key={post.id} variants={revealVariants}>
            <Link
              href={`/posts/${post.slug}`}
              className="group min-w-0 border-t border-[var(--reader-border)] pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-3 first:md:border-l-0 first:md:pl-0"
            >
              <span className="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold text-[var(--text-muted)]">
                <span className="h-2 w-2 rounded-full bg-[var(--accent-sky)] shadow-[0_0_0_4px_color-mix(in_oklab,var(--accent-sky)_12%,transparent)]" />
                {formatTime(post.publishedAt ?? post.createdAt, index)}
              </span>
              <span className="line-clamp-2 text-xs font-semibold leading-5 text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">
                {trimDailyTitle(post.title)}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
