import Link from "next/link";
import { Clock3 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatCard } from "@/components/admin/primitives/StatCard";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

function getSevenDaysAgo() {
  const value = new Date();
  value.setDate(value.getDate() - 7);
  return value;
}

async function getRecentPosts() {
  return prisma.post.findMany({
    where: { deletedAt: null },
    select: { id: true, title: true, slug: true, published: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
}

async function getDraftQueue() {
  return prisma.post.findMany({
    where: { deletedAt: null, published: false },
    select: { id: true, title: true, slug: true, published: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}

async function getRecentComments() {
  return prisma.comment.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      content: true,
      createdAt: true,
      status: true,
      authorLabel: true,
      author: { select: { name: true, email: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
}

async function getPendingCommentQueue() {
  return prisma.comment.findMany({
    where: { deletedAt: null, status: PENDING_COMMENT_STATUS },
    select: {
      id: true,
      content: true,
      createdAt: true,
      status: true,
      authorLabel: true,
      author: { select: { name: true, email: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}

type AdminPostListItem = Awaited<ReturnType<typeof getRecentPosts>>[number];
type AdminCommentListItem = Awaited<ReturnType<typeof getRecentComments>>[number] & {
  status: CommentStatus;
};

const commentToneMap: Record<CommentStatus, "success" | "warning" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  SPAM: "danger",
};

const commentLabelMap: Record<CommentStatus, string> = {
  APPROVED: "已通过",
  PENDING: "待审核",
  REJECTED: "已驳回",
  SPAM: "垃圾",
};

const PENDING_COMMENT_STATUS: CommentStatus = "PENDING";

const formatDateLabel = (value: Date | string) =>
  new Date(value).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });

export default async function AdminPage() {
  const sevenDaysAgo = getSevenDaysAgo();

  const [
    postCount,
    draftCount,
    pendingCommentCount,
    categoryCount,
    tagCount,
    publishedLast7Days,
    draftQueue,
    pendingQueue,
    recentPosts,
    recentComments,
  ] = await Promise.all([
    prisma.post.count({ where: { deletedAt: null } }),
    prisma.post.count({ where: { deletedAt: null, published: false } }),
    prisma.comment.count({ where: { deletedAt: null, status: PENDING_COMMENT_STATUS } }),
    prisma.category.count({ where: { deletedAt: null } }),
    prisma.tag.count({ where: { deletedAt: null } }),
    prisma.post.count({
      where: { deletedAt: null, published: true, publishedAt: { gte: sevenDaysAgo } },
    }),
    getDraftQueue(),
    getPendingCommentQueue(),
    getRecentPosts(),
    getRecentComments(),
  ]);

  const structureCount = categoryCount + tagCount;
  const changePosts = recentPosts.slice(0, 3);
  const changeComments = recentComments.slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Editorial"
        title="编辑部总览"
        description="把待发布内容、最近变更和内容风险收进同一工作台。"
        action={
          <Link href="/admin/posts/new">
            <Button size="sm">新建文章</Button>
          </Link>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="全部文章" value={postCount} hint={`${draftCount} 篇仍在写作中`} />
        <StatCard label="待处理评论" value={pendingCommentCount} hint="优先审查高风险互动" />
        <StatCard label="最近发布" value={publishedLast7Days} hint="过去 7 天上线的内容" />
        <StatCard label="结构节点" value={structureCount} hint="分类与标签总数" />
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <WorkspacePanel
          title="待处理工作"
          description="先做会影响发布节奏的草稿与评论。"
          actions={
            <Link href="/admin/posts">
              <Button size="sm" variant="outline">
                查看全部队列
              </Button>
            </Link>
          }
          className="space-y-6 border border-[var(--border)]"
        >
          <div className="space-y-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">草稿队列</p>
              <div className="mt-3 space-y-3">
                {draftQueue.length > 0 ? (
                  draftQueue.map((post: AdminPostListItem) => (
                    <Link
                      key={post.id}
                      href={`/admin/posts/${post.id}/edit`}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--brand)]"
                    >
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{post.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {formatDateLabel(post.createdAt)} · /posts/{post.slug}
                        </p>
                      </div>
                      <StatusBadge tone="warning">草稿</StatusBadge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">当前没有需要处理的草稿。</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">待处理评论</p>
              <div className="mt-3 space-y-3">
                {pendingQueue.length > 0 ? (
                  pendingQueue.map((comment: AdminCommentListItem) => (
                    <Link
                      key={comment.id}
                      href={`/posts/${comment.post.slug}`}
                      className="group flex items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--brand)]"
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-[var(--foreground)]">
                          {comment.authorLabel || comment.author?.name || comment.author?.email || "匿名访客"}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{formatDateLabel(comment.createdAt)}</p>
                        <p className="mt-1 text-sm text-[var(--muted)] line-clamp-2">{comment.content}</p>
                      </div>
                      <StatusBadge tone="warning">待审核</StatusBadge>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">当前没有需要审核的评论。</p>
                )}
              </div>
            </div>
          </div>
        </WorkspacePanel>

        <WorkspacePanel
          title="最近变更"
          description="文章与评论的最新动向，一目了然。"
          actions={
            <Link href="/admin/comments">
              <Button size="sm" variant="secondary">
                查看评论治理
              </Button>
            </Link>
          }
          className="space-y-6 border border-[var(--border)]"
        >
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[var(--muted)]" />
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">文章动态</p>
              </div>
              <div className="mt-3 space-y-3">
                {changePosts.map((post: AdminPostListItem) => (
                  <article
                    key={post.id}
                    className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <Link href={`/admin/posts/${post.id}/edit`} className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--foreground)]">{post.title}</p>
                      <StatusBadge tone={post.published ? "success" : "warning"}>
                        {post.published ? "已发布" : "草稿"}
                      </StatusBadge>
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {formatDateLabel(post.createdAt)} · /posts/{post.slug}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">评论动态</p>
              </div>
              <div className="mt-3 space-y-3">
                {changeComments.map((comment: AdminCommentListItem) => {
                  const status = comment.status as CommentStatus;

                  return (
                    <article
                      key={comment.id}
                      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[var(--foreground)]">
                            {comment.authorLabel || comment.author?.name || comment.author?.email || "匿名访客"}
                          </p>
                          <p className="text-xs text-[var(--muted)]">{formatDateLabel(comment.createdAt)}</p>
                        </div>
                        <StatusBadge tone={commentToneMap[status]}>
                          {commentLabelMap[status]}
                        </StatusBadge>
                      </div>
                      <p className="mt-2 text-sm text-[var(--muted)] line-clamp-2">{comment.content}</p>
                      <Link
                        href={`/posts/${comment.post.slug}`}
                        className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
                      >
                        查看《{comment.post.title}》
                      </Link>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </WorkspacePanel>
      </section>
    </div>
  );
}
