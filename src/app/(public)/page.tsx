export const revalidate = 300;

import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ArrowRight, Code2, Database, FileText, Palette, User, Zap } from "lucide-react";
import { PostCard } from "@/components/blog";
import { prisma } from "@/lib/prisma";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "My Blog",
  description: "一个基于 Next.js 构建的现代化博客系统。",
  path: "/",
});

async function getData() {
  try {
    const [posts, categories] = await Promise.all([
      prisma.post.findMany({
        where: { published: true },
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: true,
          tags: true,
          _count: { select: { comments: true, likes: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 3,
      }),
      prisma.category.findMany({
        include: { _count: { select: { posts: true } } },
        orderBy: { posts: { _count: "desc" } },
        take: 12,
      }),
    ]);

    return { posts, categories };
  } catch (error) {
    console.error("Load home page data error:", error);
    return { posts: [], categories: [] };
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>["posts"][number];
type HomeCategory = Awaited<ReturnType<typeof getData>>["categories"][number];

export default async function Home() {
  const { posts, categories } = await getData();

  return (
    <div className="space-y-8">
      <section className="card-base onload-animation relative overflow-hidden p-8 text-center md:p-12">
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-(--primary)/5 via-transparent to-(--primary)/3" />
        <div className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-(--primary)/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-36 w-36 rounded-full bg-(--primary)/5 blur-3xl" />
        <div className="relative">
          <h1 className="text-90 mb-4 text-4xl font-bold md:text-5xl">欢迎来到 My Blog</h1>
          <p className="text-75 mx-auto max-w-2xl text-lg leading-relaxed md:text-xl">
            基于 Next.js 和 Prisma 构建的现代化博客平台
            <br />
            采用 BlogT3 风格设计系统
          </p>
        </div>
      </section>

      <section className="onload-animation space-y-4" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-90 text-2xl font-bold">最新文章</h2>
          <Link href="/posts" className="btn-plain scale-animation flex h-9 items-center gap-1 rounded-lg px-4 text-sm">
            查看全部
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="space-y-4">
          {posts.map((post: HomePost, index: number) => (
            <div key={post.id} className="onload-animation" style={{ animationDelay: `${100 + index * 50}ms` }}>
              <PostCard post={post} />
            </div>
          ))}
        </div>
      </section>

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: "250ms" }}>
        <h2 className="text-90 mb-6 text-2xl font-bold">分类浏览</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((category: HomeCategory) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-full bg-[var(--btn-regular-bg)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition-all hover:scale-105 hover:bg-[var(--btn-regular-bg-hover)]"
            >
              {category.name} ({category._count.posts})
            </Link>
          ))}
        </div>
      </section>

      <section className="onload-animation grid gap-4 md:grid-cols-3" style={{ animationDelay: "300ms" }}>
        <Link href="/posts" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <FileText className="h-5 w-5 text-[var(--primary)]" />博客文章
          </h3>
          <p className="text-75 text-sm">查看所有技术文章和教程</p>
        </Link>
        <Link href="/categories" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <Archive className="h-5 w-5 text-[var(--primary)]" />分类归档
          </h3>
          <p className="text-75 text-sm">按分类浏览所有内容</p>
        </Link>
        <Link href="/tags" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <User className="h-5 w-5 text-[var(--primary)]" />标签探索
          </h3>
          <p className="text-75 text-sm">通过标签发现相关主题</p>
        </Link>
      </section>

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: "350ms" }}>
        <h2 className="text-90 mb-6 text-2xl font-bold">主要特性</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Palette className="h-5 w-5 text-primary" />动态主题系统</h3>
            <p className="text-75 text-sm">使用 OKLCH 色彩空间，支持色相调整与明暗切换</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Zap className="h-5 w-5 text-primary" />Next.js</h3>
            <p className="text-75 text-sm">现代化 App Router 与组件化渲染体验</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Database className="h-5 w-5 text-primary" />Prisma</h3>
            <p className="text-75 text-sm">类型安全 ORM，提供稳定的数据建模与访问能力</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Code2 className="h-5 w-5 text-primary" />TypeScript</h3>
            <p className="text-75 text-sm">完整类型系统，提升开发效率和代码质量</p>
          </div>
        </div>
      </section>
    </div>
  );
}
