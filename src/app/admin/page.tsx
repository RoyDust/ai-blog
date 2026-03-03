import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/");
  }

  const [postCount, userCount, commentCount, categoryCount, draftCount] = await Promise.all([
    prisma.post.count(),
    prisma.user.count(),
    prisma.comment.count(),
    prisma.category.count(),
    prisma.post.count({ where: { published: false } }),
  ]);

  const cards = [
    { label: "文章总数", value: postCount },
    { label: "用户总数", value: userCount },
    { label: "评论总数", value: commentCount },
    { label: "分类总数", value: categoryCount },
    { label: "草稿数量", value: draftCount },
  ];

  return (
    <div className="space-y-6">
      <section className="ui-surface rounded-3xl p-6">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">管理后台</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">面向内容运营的高密度工作台，聚焦文章、评论与分类标签治理。</p>
      </section>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {cards.map((item) => (
          <article className="ui-surface rounded-2xl p-4 shadow-[0_10px_30px_-24px_rgba(15,118,110,0.65)]" key={item.label}>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{item.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-[var(--foreground)]">{item.value}</p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link className="ui-surface rounded-2xl p-5 transition-colors hover:bg-[var(--surface-alt)]" href="/admin/posts">
          <h2 className="font-display text-xl font-bold text-[var(--foreground)]">文章管理</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">查看、发布、下线、删除文章</p>
        </Link>
        <Link className="ui-surface rounded-2xl p-5 transition-colors hover:bg-[var(--surface-alt)]" href="/admin/comments">
          <h2 className="font-display text-xl font-bold text-[var(--foreground)]">评论管理</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">审核并治理评论内容</p>
        </Link>
        <Link className="ui-surface rounded-2xl p-5 transition-colors hover:bg-[var(--surface-alt)]" href="/admin/categories">
          <h2 className="font-display text-xl font-bold text-[var(--foreground)]">分类管理</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">维护分类结构与信息</p>
        </Link>
        <Link className="ui-surface rounded-2xl p-5 transition-colors hover:bg-[var(--surface-alt)]" href="/admin/tags">
          <h2 className="font-display text-xl font-bold text-[var(--foreground)]">标签管理</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">维护标签和颜色标识</p>
        </Link>
      </div>
    </div>
  );
}
