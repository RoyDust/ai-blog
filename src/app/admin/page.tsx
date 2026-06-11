import Link from "next/link";
import {
  BookOpenCheck,
  CheckCircle2,
  Eye,
  ImageIcon,
  MessageCircle,
  ThumbsUp,
  Timer,
} from "lucide-react";

import { EngagementTrendChart, VisitTrendChart } from "@/app/admin/AdminAnalyticsCharts";
import { AdminTodoStrip } from "@/components/admin/dashboard/AdminTodoStrip";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { FallbackImage } from "@/components/admin/ui";
import {
  getAdminStatsRangeWindow,
  getAdminTodoCounts,
  getDashboardStatsWithComparison,
  parseAdminStatsRange,
  type DashboardStats,
  type DashboardStatsWithComparison,
} from "@/lib/admin-stats";
import { getPublicAiModelOptions } from "@/lib/ai-models";
import type { VisitTrendRange } from "@/lib/analytics";
import { getBlogSettings } from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";
import { findPopularPostVisitsInRange } from "@/lib/visit-log-repository";

export const dynamic = "force-dynamic";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

const PENDING_COMMENT_STATUS: CommentStatus = "PENDING";

/**
 * 读取最近更新的草稿队列，供首页快速继续编辑。
 */
async function getDraftQueue() {
  return prisma.post.findMany({
    where: { deletedAt: null, published: false },
    select: { id: true, title: true, slug: true, excerpt: true, content: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
  });
}

/**
 * 读取待审核评论队列，便于后台首页直接暴露社区待办。
 */
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

/**
 * 读取指定访问窗口内的热门文章，按真实访问日志 PV 倒序展示。
 */
async function getPopularPosts(range: VisitTrendRange) {
  const { start, end } = getAdminStatsRangeWindow(range);
  return findPopularPostVisitsInRange(start, end, 5);
}

type DraftListItem = Awaited<ReturnType<typeof getDraftQueue>>[number];
type PendingCommentListItem = Awaited<ReturnType<typeof getPendingCommentQueue>>[number];
type PopularPostListItem = Awaited<ReturnType<typeof getPopularPosts>>[number];

const dashboardLinkClassName = "inline-flex items-center gap-2 text-sm font-semibold text-[var(--brand)] transition-colors hover:text-[var(--brand-strong)] hover:underline";
const dashboardTitleHoverClassName = "transition-colors group-hover:text-[var(--brand)]";

function PanelMetaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1 text-xs font-semibold text-[var(--text-body)]">
      {children}
    </span>
  );
}

const formatRelativeDate = (value: Date | string | null) => {
  if (!value) return "未发布";

  const date = new Date(value);
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));

  if (days === 0) return "更新于 今天";
  if (days === 1) return "更新于 昨天";
  if (days < 7) return `更新于 ${days} 天前`;

  return `更新于 ${date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`;
};

function Thumbnail({
  src,
  label,
  className = "h-16 w-24",
  placeholder = "未设置封面",
}: {
  src?: string | null;
  label: string;
  className?: string;
  placeholder?: string;
}) {
  return (
    <div className={`${className} relative shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[linear-gradient(135deg,#f4f1ea,#d7e6dc)]`}>
      {src ? (
        <FallbackImage
          alt={label}
          className="object-cover"
          fill
          loading="lazy"
          sizes="(max-width: 768px) 100vw, 18rem"
          src={src}
          unoptimized
        />
      ) : (
        <div aria-label={label} className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-[var(--muted)]" role="img">
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
          <span className="line-clamp-1 text-xs">{placeholder}</span>
        </div>
      )}
    </div>
  );
}

function Avatar({ name, index }: { name: string; index: number }) {
  const palettes = ["bg-emerald-100 text-emerald-900", "bg-sky-100 text-sky-900", "bg-amber-100 text-amber-900"];

  return (
    <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${palettes[index % palettes.length]}`}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function EmptyPanelMessage({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-[var(--surface-alt)] px-4 py-4 text-sm text-[var(--muted)]">{children}</p>;
}

function DashboardMetric({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  hint?: string;
}) {
  let FinalIcon = Icon;
  if (!FinalIcon) {
    if (label.includes("PV") || label.includes("访问")) {
      FinalIcon = Eye;
    } else if (label.includes("UV")) {
      FinalIcon = ThumbsUp;
    } else {
      FinalIcon = Eye;
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm transition-colors duration-200 hover:border-[var(--border-strong)]">
      <div className="flex items-center justify-between">
        <dt className="text-xs font-semibold text-[var(--muted)]">
          {label}
        </dt>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] text-[var(--brand)]">
          {FinalIcon ? <FinalIcon className="h-4.5 w-4.5" aria-hidden /> : null}
        </span>
      </div>
      <dd className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] font-mono">
        {typeof value === "number" ? value.toLocaleString("zh-CN") : value}
      </dd>
      {hint ? (
        <p className="mt-2 text-[10px] font-medium text-[var(--muted)] border-t border-[var(--border)] pt-1.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function formatDelta(value: number, options: { unit?: string; percent?: boolean } = {}) {
  const absoluteValue = options.percent ? Math.round(value * 100) : value;
  const formatted = Math.abs(absoluteValue).toLocaleString("zh-CN");
  const prefix = absoluteValue > 0 ? "+" : absoluteValue < 0 ? "-" : "";
  const unit = options.percent ? " 个百分点" : options.unit ? ` ${options.unit}` : "";

  return `较上期 ${prefix}${formatted}${unit}`;
}

function formatMetricValue(value: number, options: { unit?: string; percent?: boolean } = {}) {
  if (options.percent) {
    return `${Math.round(value * 100).toLocaleString("zh-CN")}%`;
  }

  return `${value.toLocaleString("zh-CN")}${options.unit ? ` ${options.unit}` : ""}`;
}

function DashboardHealthMetrics({ comparison }: { comparison: DashboardStatsWithComparison }) {
  const metrics = [
    {
      label: "7 日发布数",
      value: formatMetricValue(comparison.metrics.publishedPosts, { unit: "篇" }),
      delta: formatDelta(comparison.deltas.publishedPosts, { unit: "篇" }),
    },
    {
      label: "阅读时长",
      value: formatMetricValue(comparison.metrics.readingMinutes, { unit: "分钟" }),
      delta: formatDelta(comparison.deltas.readingMinutes, { unit: "分钟" }),
    },
    {
      label: "互动率",
      value: formatMetricValue(comparison.metrics.engagementRate, { percent: true }),
      delta: formatDelta(comparison.deltas.engagementRate, { percent: true }),
    },
    {
      label: "订阅净增",
      value: formatMetricValue(comparison.metrics.subscribers, { unit: "人" }),
      delta: formatDelta(comparison.deltas.subscribers, { unit: "人" }),
    },
  ];

  return (
    <section aria-label="内容健康指标" className="rounded-lg bg-[var(--surface)] px-4 py-4">
      <dl className="grid grid-cols-1 divide-y divide-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            aria-label={`${metric.label} ${metric.value}，${metric.delta}`}
            className={`${index === 0 ? "sm:pl-0" : ""} px-0 py-3 first:pt-0 last:pb-0 sm:px-5 sm:py-1`}
          >
            <dt className="text-xs font-semibold text-[var(--muted)]">{metric.label}</dt>
            <dd className="mt-1 font-mono text-2xl font-bold tabular-nums text-[var(--foreground)]">{metric.value}</dd>
            <p className="mt-1 text-xs text-[var(--muted)]">{metric.delta}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}

function VisitTrendPanel({ stats }: { stats: DashboardStats["visits"] }) {
  const { range, summary } = stats;
  const ranges: VisitTrendRange[] = [7, 30, 90];

  return (
    <WorkspacePanel
      title="访问趋势"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <PanelMetaPill>真实统计</PanelMetaPill>
          <div className="flex items-center overflow-hidden rounded-lg border border-[var(--border)] text-sm">
            {ranges.map((item, index) => (
              <Link
                key={item}
                href={`/admin?range=${item}`}
                className={`${index === 0 ? "" : "border-l border-[var(--border)]"} px-4 py-2 font-medium ${range === item ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]" : "text-[var(--muted)] hover:bg-[var(--surface-alt)]"}`}
              >
                {item} 天
              </Link>
            ))}
          </div>
        </div>
      }
      className="min-h-[430px]"
      reveal={false}
    >
      <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
        <DashboardMetric label="区间 PV" value={summary.totalPv} />
        <DashboardMetric label="区间 UV" value={summary.totalUv} />
        <DashboardMetric label="今日 PV" value={summary.todayPv} />
        <DashboardMetric label="昨日 PV" value={summary.yesterdayPv} />
      </dl>
      {stats.hasData ? null : <p className="pt-4 text-sm text-[var(--muted)]">近 {range} 天暂无访问数据，图表将保持零值基线。</p>}
      <VisitTrendChart stats={stats} />
    </WorkspacePanel>
  );
}

function getDraftPreview(post: DraftListItem) {
  const source = post.excerpt?.trim() || post.content.replace(/[#>*_`\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return source.length > 120 ? `${source.slice(0, 120)}…` : source || "还没有正文内容。";
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} 秒`;
  return `${Math.round(seconds / 60).toLocaleString("zh-CN")} 分钟`;
}

function ReadingStatsPanel({ stats }: { stats: DashboardStats["reading"] }) {
  return (
    <WorkspacePanel
      title="阅读统计"
      actions={<PanelMetaPill>近 {stats.range} 天</PanelMetaPill>}
      className="min-h-[300px]"
      reveal={false}
    >
      <dl className="grid grid-cols-2 gap-3">
        <DashboardMetric label="有效阅读" value={stats.summary.qualifiedEvents} icon={BookOpenCheck} />
        <DashboardMetric label="深度完成" value={stats.summary.completedEvents} icon={CheckCircle2} hint="滚动深度 >= 85%" />
        <DashboardMetric label="总阅读时长" value={formatDuration(stats.summary.totalDurationSeconds)} icon={Timer} />
        <DashboardMetric label="平均停留" value={formatDuration(stats.summary.averageDurationSeconds)} icon={Timer} />
      </dl>
      {stats.hasData ? (
        <p className="mt-4 text-sm text-[var(--muted)]">
          共记录 {stats.summary.totalEvents.toLocaleString("zh-CN")} 次阅读事件，合格率{" "}
          {stats.summary.totalEvents > 0 ? Math.round((stats.summary.qualifiedEvents / stats.summary.totalEvents) * 100) : 0}%。
        </p>
      ) : (
        <EmptyPanelMessage>近 {stats.range} 天暂无阅读事件。</EmptyPanelMessage>
      )}
    </WorkspacePanel>
  );
}

function EngagementStatsPanel({ stats }: { stats: DashboardStats["engagement"] }) {
  return (
    <WorkspacePanel
      title="互动统计"
      actions={<PanelMetaPill>近 {stats.range} 天</PanelMetaPill>}
      className="min-h-[300px]"
      reveal={false}
    >
      <dl className="grid grid-cols-3 gap-3">
        <DashboardMetric label="总互动" value={stats.summary.total} />
        <DashboardMetric label="评论" value={stats.summary.comments} icon={MessageCircle} />
        <DashboardMetric label="点赞" value={stats.summary.likes} icon={ThumbsUp} />
      </dl>
      {stats.hasData ? null : <p className="pt-4 text-sm text-[var(--muted)]">近 {stats.range} 天暂无评论或点赞数据。</p>}
      <EngagementTrendChart stats={stats} />
    </WorkspacePanel>
  );
}

function RecentDraftsPanel({ drafts }: { drafts: DraftListItem[] }) {
  return (
    <WorkspacePanel title="最近草稿" className="min-h-[430px]" reveal={false}>
      <div className="flex-1 flex flex-col justify-between">
        {drafts.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {drafts.slice(0, 3).map((post) => (
              <article key={post.id} className="group py-4 first:pt-0 transition-transform duration-200 ease-out hover:translate-x-1">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className={`truncate text-base font-semibold text-[var(--foreground)] ${dashboardTitleHoverClassName}`}>{post.title}</h3>
                  <StatusBadge tone="warning">草稿</StatusBadge>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{getDraftPreview(post)}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-[var(--muted)]">{formatRelativeDate(post.updatedAt ?? post.createdAt)}</p>
                  <Link
                    href={`/admin/posts/${post.id}/edit`}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--brand)]"
                  >
                    继续编辑
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage>当前没有最近草稿。</EmptyPanelMessage>
        )}
        <Link href="/admin/posts" className={`mt-auto pt-4 ${dashboardLinkClassName}`}>
          查看全部草稿
          <span aria-hidden>→</span>
        </Link>
      </div>
    </WorkspacePanel>
  );
}

function PendingCommentsPanel({ comments, count }: { comments: PendingCommentListItem[]; count: number }) {
  return (
    <WorkspacePanel
      title="待审评论"
      actions={<PanelMetaPill>{count}</PanelMetaPill>}
      className="min-h-[460px]"
      reveal={false}
    >
      <div className="flex-1 flex flex-col justify-between">
        <div className="divide-y divide-[var(--border)]">
          {comments.length > 0 ? (
            comments.map((comment, index) => {
              const authorName = comment.authorLabel || comment.author?.name || comment.author?.email || "匿名访客";

              return (
                <article key={comment.id} className="group flex gap-4 py-5 first:pt-0 transition-transform duration-200 ease-out hover:translate-x-1">
                  <Avatar name={authorName} index={index} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-bold text-[var(--foreground)] ${dashboardTitleHoverClassName}`}>{authorName}</h3>
                      <span className="text-sm text-[var(--muted)]">评论于《{comment.post.title}》</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-body)]">{comment.content}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-[var(--muted)]">{formatRelativeDate(comment.createdAt).replace("更新于 ", "")}</span>
                      <Link href="/admin/comments" className="font-semibold text-[var(--brand)] hover:underline">
                        批准
                      </Link>
                      <Link href="/admin/comments" className="font-semibold text-rose-500 hover:underline">
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
        <Link href="/admin/comments" className={`mt-auto pt-4 ${dashboardLinkClassName}`}>
          查看全部评论
          <span aria-hidden>→</span>
        </Link>
      </div>
    </WorkspacePanel>
  );
}

function PopularPostsPanel({ posts, range }: { posts: PopularPostListItem[]; range: VisitTrendRange }) {
  const rankTone = [
    "bg-[var(--brand)] text-white",
    "bg-[var(--btn-regular-bg-active)] text-[var(--btn-content)]",
    "bg-[var(--surface-alt)] text-[var(--foreground)]",
    "bg-slate-100 dark:bg-slate-800 text-[var(--muted)]",
    "bg-slate-100 dark:bg-slate-800 text-[var(--muted)]",
  ];

  return (
    <WorkspacePanel
      title="热门文章"
      actions={<PanelMetaPill>近 {range} 天</PanelMetaPill>}
      className="min-h-[460px]"
      reveal={false}
    >
      <div className="flex-1 flex flex-col justify-between">
        {posts.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {posts.slice(0, 5).map((post, index) => (
              <article key={post.id} className="flex items-center gap-4 py-4 first:pt-0 transition-transform duration-200 ease-out hover:translate-x-1">
                <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankTone[index] ?? rankTone[4]}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/posts/${post.slug}`} className="line-clamp-1 font-semibold text-[var(--foreground)] transition-colors hover:text-[var(--brand)]">
                    {post.title}
                  </Link>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--muted)]">
                    <Eye className="h-3.5 w-3.5" />
                    {post.visitCount.toLocaleString("zh-CN")} 浏览
                  </p>
                </div>
                <Thumbnail src={post.coverImage} label={`${post.title} 封面`} className="h-16 w-24" />
              </article>
            ))}
          </div>
        ) : (
          <EmptyPanelMessage>近 {range} 天暂无文章浏览数据。</EmptyPanelMessage>
        )}
        <Link href="/admin/posts" className={`mt-auto pt-4 ${dashboardLinkClassName}`}>
          查看全部文章
          <span aria-hidden>→</span>
        </Link>
      </div>
    </WorkspacePanel>
  );
}

/**
 * 后台首页入口。
 * 使用并发查询一次性拿到首页卡片所需数据，避免串行等待拖慢首屏。
 */
export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string }> } = {}) {
  const resolvedSearchParams = await searchParams;
  const range = parseAdminStatsRange(resolvedSearchParams?.range);
  const [todoCounts, draftQueue, pendingQueue, popularPosts, aiModels, dashboardComparison, blogSettings] = await Promise.all([
    getAdminTodoCounts(),
    getDraftQueue(),
    getPendingCommentQueue(),
    getPopularPosts(range),
    getPublicAiModelOptions(),
    getDashboardStatsWithComparison(range),
    getBlogSettings(),
  ]);
  const dashboardStats = dashboardComparison.current;
  const hasReadyAiModel = aiModels.some((model) => model.status === "ready");

  return (
    <div className="space-y-5 2xl:space-y-6" data-testid="admin-dashboard">
      <AdminTodoStrip counts={todoCounts} showAiModelWarning={!hasReadyAiModel} />

      <DashboardHealthMetrics comparison={dashboardComparison} />

      <section className="grid grid-cols-1 gap-5 2xl:gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(440px,0.75fr)]">
        <VisitTrendPanel stats={dashboardStats.visits} />
        <div id="stale-drafts">
          <RecentDraftsPanel drafts={draftQueue} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:gap-6 lg:grid-cols-2">
        <ReadingStatsPanel stats={dashboardStats.reading} />
        <EngagementStatsPanel stats={dashboardStats.engagement} />
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:gap-6 lg:grid-cols-2">
        <div id="pending-comments">
          <PendingCommentsPanel comments={pendingQueue} count={todoCounts.pendingComments} />
        </div>
        <PopularPostsPanel posts={popularPosts} range={range} />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
        <p>© 2024 {blogSettings.siteName} · 记录与分享技术、生活与思考。</p>
        <p>版本 1.0.0 · 帮助文档 ↗</p>
      </footer>
    </div>
  );
}
