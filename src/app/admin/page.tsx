import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Eye,
  MoreHorizontal,
} from "lucide-react";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

const PENDING_COMMENT_STATUS: CommentStatus = "PENDING";

export const STATIC_VISIT_TREND = [
  { label: "05-15", visits: 1700 },
  { label: "05-16", visits: 2200 },
  { label: "05-17", visits: 3180 },
  { label: "05-18", visits: 2350 },
  { label: "05-19", visits: 1620 },
  { label: "05-20", visits: 1950 },
  { label: "05-21", visits: 2680 },
] as const;

export const STATIC_DASHBOARD_PUBLISH_CHECKLIST = [
  { label: "文章有封面图", description: "为文章设置一张吸引人的封面图", done: true },
  { label: "设置文章分类", description: "为文章选择合适的分类", done: true },
  { label: "添加文章摘要", description: "撰写 1-2 句摘要，吸引读者", done: true },
  { label: "检查错别字", description: "发布前检查错别字和语句通顺", done: false },
  { label: "设置 SEO 信息", description: "设置标题、描述和关键词", done: false },
] as const;

async function getDraftQueue() {
  return prisma.post.findMany({
    where: { deletedAt: null, published: false },
    select: { id: true, title: true, slug: true, coverImage: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });
}

async function getPendingCommentQueue() {
  return prisma.comment.findMany({
    where: { deletedAt: null, status: PENDING_COMMENT_STATUS },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorLabel: true,
      author: { select: { name: true, email: true } },
      post: { select: { title: true, slug: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
}

async function getPopularPosts() {
  return prisma.post.findMany({
    where: { deletedAt: null, published: true },
    select: { id: true, title: true, slug: true, coverImage: true, viewCount: true, publishedAt: true },
    orderBy: { viewCount: "desc" },
    take: 5,
  });
}

type DraftListItem = Awaited<ReturnType<typeof getDraftQueue>>[number];
type PendingCommentListItem = Awaited<ReturnType<typeof getPendingCommentQueue>>[number];
type PopularPostListItem = Awaited<ReturnType<typeof getPopularPosts>>[number];

const formatRelativeDate = (value: Date | string | null) => {
  if (!value) return "未发布";

  const date = new Date(value);
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));

  if (days === 0) return "更新于 今天";
  if (days === 1) return "更新于 昨天";
  if (days < 7) return `更新于 ${days} 天前`;

  return `更新于 ${date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`;
};

const getChartGeometry = () => {
  const width = 760;
  const height = 238;
  const paddingX = 12;
  const paddingTop = 20;
  const paddingBottom = 30;
  const max = 4000;
  const points = STATIC_VISIT_TREND.map((item, index) => {
    const x = paddingX + (index / (STATIC_VISIT_TREND.length - 1)) * (width - paddingX * 2);
    const y = paddingTop + (1 - item.visits / max) * (height - paddingTop - paddingBottom);
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? width} ${height - paddingBottom} L ${points[0]?.x ?? 0} ${height - paddingBottom} Z`;

  return { width, height, points, linePath, areaPath };
};

function StaticPill() {
  return (
    <span className="inline-flex items-center rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
      静态示意
    </span>
  );
}

function Thumbnail({ src, label, className = "h-16 w-24" }: { src?: string | null; label: string; className?: string }) {
  const imageStyle = src ? { backgroundImage: `url("${src}")` } : undefined;

  return (
    <div
      aria-label={label}
      className={`${className} shrink-0 rounded-lg border border-[var(--border)] bg-[linear-gradient(135deg,#f4f1ea,#d7e6dc)] bg-cover bg-center`}
      style={imageStyle}
    />
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  const palettes = ["bg-emerald-100 text-emerald-800", "bg-sky-100 text-sky-800", "bg-stone-200 text-stone-700"];

  return (
    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${palettes[index % palettes.length]}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function EmptyPanelMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-[var(--surface-alt)] px-4 py-4 text-sm text-[var(--muted)]">{children}</p>;
}

function VisitTrendPanel() {
  const chart = getChartGeometry();

  return (
    <WorkspacePanel
      title="访问趋势"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <StaticPill />
          <div className="flex items-center overflow-hidden rounded-lg border border-[var(--border)] text-sm">
            <span className="bg-emerald-50 px-4 py-2 font-medium text-[var(--brand)]">7 天</span>
            <span className="border-l border-[var(--border)] px-4 py-2 text-[var(--muted)]">30 天</span>
            <span className="border-l border-[var(--border)] px-4 py-2 text-[var(--muted)]">90 天</span>
          </div>
        </div>
      }
      className="min-h-[378px]"
    >
      <div className="flex h-[278px] gap-3 pt-3">
        <div className="flex w-9 flex-col justify-between pb-9 pt-2 text-right text-xs text-[var(--muted)]">
          <span>4K</span>
          <span>3K</span>
          <span>2K</span>
          <span>1K</span>
          <span>0</span>
        </div>
        <svg className="h-full min-w-0 flex-1 overflow-visible" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="最近 7 天访问趋势静态示意">
          <defs>
            <linearGradient id="visit-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#23875f" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#23875f" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((line) => {
            const y = 20 + line * 47;
            return <line key={line} x1="12" x2="748" y1={y} y2={y} stroke="rgba(23,32,27,0.09)" strokeWidth="1" />;
          })}
          <path d={chart.areaPath} fill="url(#visit-area)" />
          <path d={chart.linePath} fill="none" stroke="#23875f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" />
          {chart.points.map((point) => (
            <circle key={point.label} cx={point.x} cy={point.y} fill="#23875f" r="4.2" stroke="#fff" strokeWidth="2" />
          ))}
          {chart.points.map((point) => (
            <text key={`${point.label}-label`} x={point.x} y="232" fill="#778178" fontSize="12" textAnchor="middle">
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </WorkspacePanel>
  );
}

function RecentDraftsPanel({ drafts }: { drafts: DraftListItem[] }) {
  return (
    <WorkspacePanel title="最近草稿" className="min-h-[378px]">
      <div className="divide-y divide-[var(--border)]">
        {drafts.length > 0 ? (
          drafts.map((post) => (
            <article key={post.id} className="flex items-center gap-4 py-4 first:pt-0">
              <Thumbnail src={post.coverImage} label={`${post.title} 封面`} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{post.title}</h3>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[var(--brand)]">草稿</span>
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">{formatRelativeDate(post.updatedAt ?? post.createdAt)}</p>
              </div>
              <Link
                href={`/admin/posts/${post.id}/edit`}
                className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
              >
                继续编辑
              </Link>
              <button aria-label={`${post.title} 更多操作`} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)]" type="button">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </article>
          ))
        ) : (
          <EmptyPanelMessage>当前没有最近草稿。</EmptyPanelMessage>
        )}
      </div>
      <Link href="/admin/posts?status=draft" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
        查看全部草稿
        <span aria-hidden>→</span>
      </Link>
    </WorkspacePanel>
  );
}

function PendingCommentsPanel({ comments, count }: { comments: PendingCommentListItem[]; count: number }) {
  return (
    <WorkspacePanel
      title="待审评论"
      actions={<span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">{count}</span>}
      className="min-h-[430px]"
    >
      <div className="divide-y divide-[var(--border)]">
        {comments.length > 0 ? (
          comments.map((comment, index) => {
            const authorName = comment.authorLabel || comment.author?.name || comment.author?.email || "匿名访客";

            return (
              <article key={comment.id} className="flex gap-4 py-5 first:pt-0">
                <Avatar name={authorName} index={index} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-[var(--foreground)]">{authorName}</h3>
                    <span className="text-sm text-[var(--muted)]">评论于《{comment.post.title}》</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-body)]">{comment.content}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                    <span className="text-[var(--muted)]">{formatRelativeDate(comment.createdAt).replace("更新于 ", "")}</span>
                    <Link href="/admin/comments" className="font-medium text-[var(--brand)]">
                      批准
                    </Link>
                    <Link href="/admin/comments" className="font-medium text-red-500">
                      垃圾
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <EmptyPanelMessage>当前没有待审核评论。</EmptyPanelMessage>
        )}
      </div>
      <Link href="/admin/comments" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
        查看全部评论
        <span aria-hidden>→</span>
      </Link>
    </WorkspacePanel>
  );
}

function PopularPostsPanel({ posts }: { posts: PopularPostListItem[] }) {
  const rankTone = ["bg-amber-400 text-white", "bg-slate-200 text-slate-700", "bg-orange-400 text-white", "bg-emerald-50 text-[var(--brand)]", "bg-emerald-50 text-[var(--brand)]"];

  return (
    <WorkspacePanel title="热门文章" className="min-h-[430px]">
      <div className="divide-y divide-[var(--border)]">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <article key={post.id} className="flex items-center gap-4 py-3 first:pt-0">
              <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${rankTone[index] ?? rankTone[4]}`}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/posts/${post.slug}`} className="line-clamp-1 font-semibold text-[var(--foreground)] hover:text-[var(--brand)]">
                  {post.title}
                </Link>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--muted)]">
                  <Eye className="h-4 w-4" />
                  {post.viewCount.toLocaleString("zh-CN")} 浏览
                </p>
              </div>
              <Thumbnail src={post.coverImage} label={`${post.title} 封面`} className="h-14 w-20" />
            </article>
          ))
        ) : (
          <EmptyPanelMessage>暂无已发布文章浏览数据。</EmptyPanelMessage>
        )}
      </div>
      <Link href="/admin/posts" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
        查看全部文章
        <span aria-hidden>→</span>
      </Link>
    </WorkspacePanel>
  );
}

function PublishChecklistPanel() {
  return (
    <WorkspacePanel title="发布清单" className="min-h-[430px]">
      <ul className="divide-y divide-[var(--border)]">
        {STATIC_DASHBOARD_PUBLISH_CHECKLIST.map((item) => (
          <li key={item.label} className="flex items-start justify-between gap-4 py-4 first:pt-0">
            <div className="flex min-w-0 gap-3">
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand)]" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--muted)]" />
              )}
              <div>
                <p className="font-medium text-[var(--foreground)]">{item.label}</p>
                <p className="mt-1 text-sm leading-5 text-[var(--muted)]">{item.description}</p>
              </div>
            </div>
            {item.done ? <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[var(--brand)]" /> : <Circle className="mt-1 h-5 w-5 shrink-0 text-[var(--muted)]" />}
          </li>
        ))}
      </ul>
      <Link href="/admin/posts/new" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-blue-600">
        编辑清单
        <span aria-hidden>→</span>
      </Link>
    </WorkspacePanel>
  );
}

export default async function AdminPage() {
  const [pendingCommentCount, draftQueue, pendingQueue, popularPosts] = await Promise.all([
    prisma.comment.count({ where: { deletedAt: null, status: PENDING_COMMENT_STATUS } }),
    getDraftQueue(),
    getPendingCommentQueue(),
    getPopularPosts(),
  ]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(380px,0.82fr)]">
        <VisitTrendPanel />
        <RecentDraftsPanel drafts={draftQueue} />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.08fr_0.9fr_0.86fr]">
        <PendingCommentsPanel comments={pendingQueue} count={pendingCommentCount} />
        <PopularPostsPanel posts={popularPosts} />
        <PublishChecklistPanel />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
        <p>© 2024 roydust.top · 记录与分享技术、生活与思考。</p>
        <p>版本 1.0.0 · 帮助文档 ↗</p>
      </footer>
    </div>
  );
}
