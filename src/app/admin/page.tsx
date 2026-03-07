import Link from "next/link";
import { Clock3, FileText, FolderTree, MessageSquare, Tags } from "lucide-react";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatCard } from "@/components/admin/primitives/StatCard";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { prisma } from "@/lib/prisma";

async function getRecentPosts() {
  return prisma.post.findMany({
    select: { id: true, title: true, slug: true, published: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
}

async function getRecentComments() {
  return prisma.comment.findMany({
    select: {
      id: true,
      content: true,
      createdAt: true,
      author: { select: { name: true, email: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 4,
  });
}

type RecentPost = Awaited<ReturnType<typeof getRecentPosts>>[number];
type RecentComment = Awaited<ReturnType<typeof getRecentComments>>[number];

export default async function AdminPage() {
  const [postCount, userCount, commentCount, categoryCount, draftCount, recentPosts, recentComments] = await Promise.all([
    prisma.post.count(),
    prisma.user.count(),
    prisma.comment.count(),
    prisma.category.count(),
    prisma.post.count({ where: { published: false } }),
    getRecentPosts(),
    getRecentComments(),
  ]);

  const quickLinks = [
    { href: "/admin/posts", title: "文章管理", description: "批量查看、筛选、发布与删除文章", icon: FileText },
    { href: "/admin/comments", title: "评论治理", description: "集中处理评论与互动内容", icon: MessageSquare },
    { href: "/admin/categories", title: "分类配置", description: "统一维护分类结构与说明", icon: FolderTree },
    { href: "/admin/tags", title: "标签配置", description: "管理标签与颜色体系", icon: Tags },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="运营总览"
        description="用更接近 Ant Design Pro 的结构管理内容、互动和配置，不改变你现在的业务流。"
        action={<div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--muted)]">最近 30 天</div>}
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="文章总数" value={postCount} hint={`${draftCount} 篇待发布`} />
        <StatCard label="用户总数" value={userCount} hint="包含作者与读者账号" />
        <StatCard label="评论总数" value={commentCount} hint="衡量社区参与度" />
        <StatCard label="分类总数" value={categoryCount} hint="内容结构节点" />
        <StatCard label="草稿数量" value={draftCount} hint="待编辑或待审核" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="ui-surface rounded-3xl p-5 shadow-[0_16px_34px_-26px_rgba(15,118,110,0.55)]">
          <h2 className="font-display text-xl font-bold text-[var(--foreground)]">快捷入口</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">高频任务直接进入，减少层级跳转。</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-alt)]">
                  <div className="flex items-start gap-3">
                    <span className="rounded-2xl bg-[var(--surface-alt)] p-2 text-[var(--primary)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">{item.title}</h3>
                      <p className="mt-1 text-sm text-[var(--muted)]">{item.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="ui-surface rounded-3xl p-5 shadow-[0_16px_34px_-26px_rgba(15,118,110,0.45)]">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-[var(--surface-alt)] p-2 text-[var(--primary)]"><Clock3 className="h-5 w-5" /></span>
            <div>
              <h2 className="font-display text-xl font-bold text-[var(--foreground)]">最近活动</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">最近发布和最新评论一屏查看。</p>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {recentPosts.map((post: RecentPost) => (
              <div key={post.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/admin/posts/${post.id}/edit`} className="font-medium text-[var(--foreground)] hover:text-[var(--primary)]">{post.title}</Link>
                  <StatusBadge tone={post.published ? "success" : "warning"}>{post.published ? "已发布" : "草稿"}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{new Date(post.createdAt).toLocaleDateString("zh-CN")} · /posts/{post.slug}</p>
              </div>
            ))}

            {recentComments.map((comment: RecentComment) => (
              <div key={comment.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--foreground)]">{comment.author.name || comment.author.email}</span>
                  <span className="text-[var(--muted)]">{new Date(comment.createdAt).toLocaleDateString("zh-CN")}</span>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{comment.content}</p>
                <Link href={`/posts/${comment.post.slug}`} className="mt-2 inline-block text-xs text-[var(--primary)] hover:underline">来自《{comment.post.title}》</Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
