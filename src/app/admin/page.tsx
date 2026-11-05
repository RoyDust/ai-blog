import Link from "next/link";
import type { ReactNode } from "react";

import { EngagementTrendChart, VisitTrendChart } from "@/app/admin/AdminAnalyticsCharts";
import { AdminTodoStrip } from "@/components/admin/dashboard/AdminTodoStrip";
import { DashboardRangeTabs } from "@/components/admin/dashboard/DashboardRangeTabs";
import {
  adminHairlineRowClassName,
  adminTextActionClassName,
  adminTextActionDangerClassName,
} from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { FallbackImage } from "@/components/admin/ui";
import { Reveal, StaggerItem, StaggerList, TextLink } from "@/components/editorial";
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
import { formatIndex, formatIsoDate, formatWeekday } from "@/lib/editorial-format";
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

const timeFormatter = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });

/** 相对时间：N 分钟前 / N 小时前 / 昨天 / N 天前 / 月-日 */
function formatRelativeTime(value: Date | string | null) {
  if (!value) return "未发布";

  const date = new Date(value);
  const diffMs = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.round(diffMs / 60_000);

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.round(hours / 24);
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;

  return formatIsoDate(date);
}

/* ── 指标：等宽数值 + 无衬线 muted 单位，指标之间 1px 竖线 ───────────────── */

function MetricValue({ value, unit, size = "lg" }: { value: ReactNode; unit?: ReactNode; size?: "lg" | "md" }) {
  return (
    <span className="flex items-baseline gap-1">
      <span
        className={
          size === "lg"
            ? "font-mono text-[1.75rem] leading-[1.2] font-bold tabular-nums text-[var(--foreground)]"
            : "font-mono text-[1.25rem] leading-[1.35] font-bold tabular-nums text-[var(--foreground)]"
        }
      >
        {value}
      </span>
      {unit ? <span className={size === "lg" ? "text-[0.875rem] text-[var(--text-muted)]" : "text-[0.8125rem] text-[var(--text-muted)]"}>{unit}</span> : null}
    </span>
  );
}

/** 一行指标列：首列无竖线，其余列左侧 1px 竖线 */
function MetricColumns({ children, columns, className = "" }: { children: ReactNode; columns: 2 | 3 | 4; className?: string }) {
  const gridClassName = columns === 4 ? "grid-cols-2 lg:grid-cols-4" : columns === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <dl
      className={`grid ${gridClassName} gap-y-4 [&>div]:min-w-0 [&>div]:pl-[18px] [&>div]:border-l [&>div]:border-[var(--border)] [&>div:first-child]:border-l-0 [&>div:first-child]:pl-0 ${className}`}
    >
      {children}
    </dl>
  );
}

function formatDelta(value: number, options: { unit?: string; percent?: boolean } = {}) {
  const absoluteValue = options.percent ? Math.round(value * 100) : value;
  if (absoluteValue === 0) return "较上期 持平";

  const formatted = Math.abs(absoluteValue).toLocaleString("zh-CN");
  const prefix = absoluteValue > 0 ? "+" : "-";
  const unit = options.percent ? " 个百分点" : options.unit ? ` ${options.unit}` : "";

  return `较上期 ${prefix}${formatted}${unit}`;
}

function deltaToneClassName(value: number) {
  if (value > 0) return "text-[var(--success)]";
  if (value < 0) return "text-[var(--danger-foreground)]";
  return "text-[var(--text-muted)]";
}

function DashboardHealthMetrics({ comparison }: { comparison: DashboardStatsWithComparison }) {
  const metrics = [
    {
      label: "7 日发布数",
      value: comparison.metrics.publishedPosts.toLocaleString("zh-CN"),
      unit: "篇",
      delta: comparison.deltas.publishedPosts,
      deltaLabel: formatDelta(comparison.deltas.publishedPosts, { unit: "篇" }),
    },
    {
      label: "阅读时长",
      value: comparison.metrics.readingMinutes.toLocaleString("zh-CN"),
      unit: "分钟",
      delta: comparison.deltas.readingMinutes,
      deltaLabel: formatDelta(comparison.deltas.readingMinutes, { unit: "分钟" }),
    },
    {
      label: "互动率",
      value: Math.round(comparison.metrics.engagementRate * 100).toLocaleString("zh-CN"),
      unit: "%",
      delta: comparison.deltas.engagementRate,
      deltaLabel: formatDelta(comparison.deltas.engagementRate, { percent: true }),
    },
    {
      label: "订阅净增",
      value: comparison.metrics.subscribers.toLocaleString("zh-CN"),
      unit: "人",
      delta: comparison.deltas.subscribers,
      deltaLabel: formatDelta(comparison.deltas.subscribers, { unit: "人" }),
    },
  ];

  return (
    <Reveal as="section" aria-label="内容健康指标" className="mt-6">
      <AdminSectionHeader aside="近 7 天 · 对比上一个 7 天" title="内容健康" />
      <MetricColumns className="pt-3.5 lg:[&>div]:pl-6" columns={4}>
        {metrics.map((metric) => (
          <div aria-label={`${metric.label} ${metric.value} ${metric.unit}，${metric.deltaLabel}`} className="flex flex-col gap-0.5" key={metric.label}>
            <dt className="text-[0.8125rem] text-[var(--text-muted)]">{metric.label}</dt>
            <dd>
              <MetricValue unit={metric.unit} value={metric.value} />
            </dd>
            <dd className={`font-mono text-xs ${deltaToneClassName(metric.delta)}`}>{metric.deltaLabel}</dd>
          </div>
        ))}
      </MetricColumns>
    </Reveal>
  );
}

/* ── 访问趋势 ─────────────────────────────────────────────────────── */

function VisitTrendPanel({ stats }: { stats: DashboardStats["visits"] }) {
  const { range, summary } = stats;
  const summaryItems = [
    { label: "区间 PV", value: summary.totalPv },
    { label: "区间 UV", value: summary.totalUv },
    { label: "今日 PV", value: summary.todayPv },
    { label: "昨日 PV", value: summary.yesterdayPv },
  ];

  return (
    <section className="min-w-0">
      <AdminSectionHeader
        aside={
          <>
            <span className="text-xs">真实统计</span>
            <DashboardRangeTabs range={range} />
          </>
        }
        title="访问趋势"
      />
      <MetricColumns className="border-b border-[var(--border)] pt-3.5 pb-3" columns={4}>
        {summaryItems.map((item) => (
          <div className="flex flex-col" key={item.label}>
            <dt className="text-xs text-[var(--text-muted)]">{item.label}</dt>
            <dd>
              <MetricValue size="md" value={item.value.toLocaleString("zh-CN")} />
            </dd>
          </div>
        ))}
      </MetricColumns>
      <VisitTrendChart stats={stats} />
      {stats.hasData ? null : <p className="pt-2 text-[0.8125rem] text-[var(--text-muted)]">近 {range} 天暂无访问数据，图表将保持零值基线。</p>}
    </section>
  );
}

/* ── 阅读统计：指标行 + 6px 合格分布细条 ─────────────────────────── */

function formatDurationParts(seconds: number): Array<{ value: string; unit: string }> {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return [{ value: String(safe), unit: "秒" }];
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest > 0
    ? [
        { value: minutes.toLocaleString("zh-CN"), unit: "分" },
        { value: String(rest), unit: "秒" },
      ]
    : [{ value: minutes.toLocaleString("zh-CN"), unit: "分钟" }];
}

function DurationValue({ seconds }: { seconds: number }) {
  return (
    <span className="flex items-baseline gap-1">
      {formatDurationParts(seconds).map((part) => (
        <span className="flex items-baseline gap-0.5" key={part.unit}>
          <span className="font-mono text-[1.25rem] leading-[1.35] font-bold tabular-nums text-[var(--foreground)]">{part.value}</span>
          <span className="text-[0.8125rem] text-[var(--text-muted)]">{part.unit}</span>
        </span>
      ))}
    </span>
  );
}

function percentOf(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function DistributionBar({ label, percent, tone }: { label: string; percent: number; tone: "strong" | "muted" }) {
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_2.75rem] items-center gap-x-3 text-xs">
      <span className="text-[var(--text-body)]">{label}</span>
      <span
        aria-label={`${label} ${percent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="block h-1.5 overflow-hidden bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]"
        role="progressbar"
      >
        <span
          className={`block h-full origin-left transition-[width] duration-700 ease-out motion-reduce:transition-none ${tone === "strong" ? "bg-[var(--foreground)]" : "bg-[color-mix(in_oklab,var(--foreground)_22%,transparent)]"}`}
          style={{ width: `${percent}%` }}
        />
      </span>
      <span className="text-right font-mono text-[var(--text-muted)]">{percent}%</span>
    </div>
  );
}

function ReadingStatsPanel({ stats }: { stats: DashboardStats["reading"] }) {
  const { summary } = stats;
  const qualifiedPercent = percentOf(summary.qualifiedEvents, summary.totalEvents);

  return (
    <section className="min-w-0">
      <AdminSectionHeader aside={<span className="text-xs">近 {stats.range} 天</span>} title="阅读统计" />
      {stats.hasData ? (
        <>
          <MetricColumns className="border-b border-[var(--border)] pt-3.5 pb-3" columns={4}>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">有效阅读</dt>
              <dd>
                <MetricValue size="md" unit="次" value={summary.qualifiedEvents.toLocaleString("zh-CN")} />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">深度完成</dt>
              <dd>
                <MetricValue size="md" unit="次" value={summary.completedEvents.toLocaleString("zh-CN")} />
              </dd>
              <dd className="text-[0.6875rem] text-[var(--text-muted)]">滚动深度 ≥ 85%</dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">总阅读时长</dt>
              <dd>
                <MetricValue size="md" unit="分钟" value={Math.round(summary.totalDurationSeconds / 60).toLocaleString("zh-CN")} />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">平均停留</dt>
              <dd>
                <DurationValue seconds={summary.averageDurationSeconds} />
              </dd>
            </div>
          </MetricColumns>
          <div className="space-y-2.5 pt-4">
            <DistributionBar label="有效阅读" percent={qualifiedPercent} tone="strong" />
            <DistributionBar label="深度完成" percent={percentOf(summary.completedEvents, summary.totalEvents)} tone="strong" />
            <DistributionBar label="未达标" percent={100 - qualifiedPercent} tone="muted" />
          </div>
          <p className="pt-3.5 text-[0.8125rem] text-[var(--text-body)]">
            共记录 <span className="font-mono">{summary.totalEvents.toLocaleString("zh-CN")}</span> 次阅读事件，合格率{" "}
            <span className="font-mono">{qualifiedPercent}%</span>。
          </p>
        </>
      ) : (
        <EmptyLine>近 {stats.range} 天暂无阅读事件。</EmptyLine>
      )}
    </section>
  );
}

function EngagementStatsPanel({ stats }: { stats: DashboardStats["engagement"] }) {
  return (
    <section className="min-w-0">
      <AdminSectionHeader aside={<span className="text-xs">近 {stats.range} 天</span>} title="互动统计" />
      {stats.hasData ? (
        <>
          <MetricColumns className="border-b border-[var(--border)] pt-3.5 pb-3" columns={3}>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">总互动</dt>
              <dd>
                <MetricValue size="md" value={stats.summary.total.toLocaleString("zh-CN")} />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">评论</dt>
              <dd>
                <MetricValue size="md" value={stats.summary.comments.toLocaleString("zh-CN")} />
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className="text-xs text-[var(--text-muted)]">点赞</dt>
              <dd>
                <MetricValue size="md" value={stats.summary.likes.toLocaleString("zh-CN")} />
              </dd>
            </div>
          </MetricColumns>
          <EngagementTrendChart stats={stats} />
        </>
      ) : (
        <EmptyLine>近 {stats.range} 天暂无评论或点赞数据。</EmptyLine>
      )}
    </section>
  );
}

/* ── 空态：一句衬线文案 + 文字链接，左对齐无容器 ─────────────────── */

function EmptyLine({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="space-y-1.5 pt-4">
      <p className="font-serif text-base font-bold text-[var(--foreground)]">{children}</p>
      {action}
    </div>
  );
}

/* ── 最近草稿 ─────────────────────────────────────────────────────── */

function getDraftPreview(post: DraftListItem) {
  const source = post.excerpt?.trim() || post.content.replace(/[#>*_`\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return source.length > 120 ? `${source.slice(0, 120)}…` : source || "还没有正文内容。";
}

function RecentDraftsPanel({ drafts }: { drafts: DraftListItem[] }) {
  const visibleDrafts = drafts.slice(0, 3);

  return (
    <section className="flex min-w-0 flex-col">
      <AdminSectionHeader count={visibleDrafts.length > 0 ? visibleDrafts.length : undefined} title="最近草稿" />
      {visibleDrafts.length > 0 ? (
        <>
          <StaggerList>
            {visibleDrafts.map((post) => (
              <StaggerItem as="article" className={`group ${adminHairlineRowClassName} flex flex-col gap-1.5 py-3.5`} key={post.id}>
                <div className="flex items-baseline gap-2.5">
                  <h3 className="min-w-0 flex-1 truncate font-serif text-base leading-[1.45] font-bold text-[var(--foreground)] decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 group-hover:underline">
                    {post.title}
                  </h3>
                  <StatusBadge tone="warning">草稿</StatusBadge>
                </div>
                <p className="line-clamp-2 text-[0.8125rem] leading-[1.7] text-[var(--text-muted)]">{getDraftPreview(post)}</p>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs text-[var(--text-muted)]">{formatRelativeTime(post.updatedAt ?? post.createdAt)}</span>
                  {/* 整行可点：链接的 ::after 铺满整行 */}
                  <Link
                    className={`${adminTextActionClassName} after:absolute after:inset-0 after:content-['']`}
                    href={`/admin/posts/${post.id}/edit`}
                  >
                    <span>继续编辑</span>
                    <span aria-hidden="true" className="ml-1 inline-block no-underline transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transition-none">
                      →
                    </span>
                  </Link>
                </div>
              </StaggerItem>
            ))}
          </StaggerList>
          <div className="pt-1.5">
            <TextLink className="text-[0.8125rem]" href="/admin/posts">
              查看全部草稿
            </TextLink>
          </div>
        </>
      ) : (
        <EmptyLine
          action={
            <TextLink className="text-[0.8125rem]" href="/admin/posts/new">
              新建文章
            </TextLink>
          }
        >
          当前没有最近草稿。
        </EmptyLine>
      )}
    </section>
  );
}

/* ── 待审评论 ─────────────────────────────────────────────────────── */

function PendingCommentsPanel({ comments, count }: { comments: PendingCommentListItem[]; count: number }) {
  return (
    <section className="flex min-w-0 flex-col">
      <AdminSectionHeader count={count > 0 ? count.toLocaleString("zh-CN") : undefined} title="待审评论" />
      {comments.length > 0 ? (
        <StaggerList>
          {comments.map((comment) => {
            const authorName = comment.authorLabel || comment.author?.name || comment.author?.email || "匿名访客";

            return (
              <StaggerItem as="article" className="flex gap-3 border-b border-[var(--border)] py-3.5" key={comment.id}>
                <span
                  aria-hidden="true"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)] text-xs font-bold text-[var(--text-body)]"
                >
                  {authorName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-[0.8125rem]">
                    <h3 className="shrink-0 font-bold text-[var(--foreground)]">{authorName}</h3>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-muted)]">评论于《{comment.post.title}》</span>
                    <span className="shrink-0 font-mono text-xs text-[var(--text-muted)]">{formatRelativeTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[0.9375rem] leading-[1.6] text-[var(--text-body)]">{comment.content}</p>
                  <div className="mt-1 flex items-center gap-4">
                    <Link className={adminTextActionClassName} href="/admin/comments">
                      批准
                    </Link>
                    <Link className={adminTextActionDangerClassName} href="/admin/comments">
                      标为垃圾
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            );
          })}
        </StaggerList>
      ) : (
        <EmptyLine>当前没有待审核评论。</EmptyLine>
      )}
      <div className="pt-3">
        <TextLink className="text-[0.8125rem]" href="/admin/comments">
          查看全部评论
        </TextLink>
      </div>
    </section>
  );
}

/* ── 热门文章：等宽序号（前 3 名 foreground）+ 衬线标题 + 4:3 缩略图 ─── */

function PopularThumbnail({ src, label }: { src?: string | null; label: string }) {
  return (
    <div className="relative h-[72px] w-24 shrink-0 overflow-hidden rounded-[var(--radius-ctl)] bg-[var(--surface-alt)]">
      {src ? (
        <FallbackImage
          alt={label}
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.035] motion-reduce:transition-none"
          fill
          loading="lazy"
          sizes="96px"
          src={src}
          unoptimized
        />
      ) : (
        <span aria-label={label} className="block h-full w-full" role="img" />
      )}
    </div>
  );
}

function PopularPostsPanel({ posts, range }: { posts: PopularPostListItem[]; range: VisitTrendRange }) {
  const visiblePosts = posts.slice(0, 5);

  return (
    <section className="flex min-w-0 flex-col">
      <AdminSectionHeader aside={<span className="text-xs">近 {range} 天</span>} title="热门文章" />
      {visiblePosts.length > 0 ? (
        <StaggerList>
          {visiblePosts.map((post, index) => (
            <StaggerItem as="article" className={`group ${adminHairlineRowClassName} flex items-center gap-4 py-3`} key={post.id}>
              <span
                className={`w-7 shrink-0 font-mono text-[1.25rem] leading-none ${index < 3 ? "text-[var(--foreground)]" : "text-[var(--text-muted)]"}`}
              >
                {formatIndex(index + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  className="block truncate font-serif text-base leading-[1.45] font-bold text-[var(--foreground)] decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 group-hover:underline after:absolute after:inset-0 after:content-['']"
                  href={`/posts/${post.slug}`}
                >
                  {post.title}
                </Link>
                <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">{post.visitCount.toLocaleString("zh-CN")} 次浏览</p>
              </div>
              <PopularThumbnail label={`${post.title} 封面`} src={post.coverImage} />
            </StaggerItem>
          ))}
        </StaggerList>
      ) : (
        <EmptyLine>近 {range} 天暂无文章浏览数据。</EmptyLine>
      )}
      <div className="pt-3">
        <TextLink className="text-[0.8125rem]" href="/admin/posts">
          查看全部文章
        </TextLink>
      </div>
    </section>
  );
}

/** 两栏之间的 1px 竖线（窄屏变为横向留白） */
function ColumnRule() {
  return <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] lg:block" />;
}

/**
 * 后台首页入口（方向 A，原型 13）。
 * 使用并发查询一次性拿到首页各区块所需数据，避免串行等待拖慢首屏。
 */
export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string }> } = {}) {
  const resolvedSearchParams = await searchParams;
  const range = parseAdminStatsRange(resolvedSearchParams?.range);
  const [todoCounts, draftQueue, pendingQueue, popularPosts, aiModels, dashboardComparison] = await Promise.all([
    getAdminTodoCounts(),
    getDraftQueue(),
    getPendingCommentQueue(),
    getPopularPosts(range),
    getPublicAiModelOptions(),
    getDashboardStatsWithComparison(range),
  ]);
  const dashboardStats = dashboardComparison.current;
  const hasReadyAiModel = aiModels.some((model) => model.status === "ready");
  const now = new Date();

  return (
    <div data-testid="admin-dashboard">
      <PageHeader
        eyebrow="后台首页"
        meta={
          <>
            <span>
              {formatIsoDate(now)} {formatWeekday(now).replace("星期", "周")}
            </span>
            <span aria-hidden="true" className="ed-meta-sep">
              ·
            </span>
            <span>统计截至 {timeFormatter.format(now)}</span>
          </>
        }
        title="今日概览"
      />

      <AdminTodoStrip counts={todoCounts} showAiModelWarning={!hasReadyAiModel} />

      <DashboardHealthMetrics comparison={dashboardComparison} />

      <Reveal className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 xl:grid-cols-[minmax(0,1.45fr)_1px_minmax(400px,0.75fr)]">
        <VisitTrendPanel stats={dashboardStats.visits} />
        <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] xl:block" />
        <div id="stale-drafts">
          <RecentDraftsPanel drafts={draftQueue} />
        </div>
      </Reveal>

      <Reveal className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        <ReadingStatsPanel stats={dashboardStats.reading} />
        <ColumnRule />
        <EngagementStatsPanel stats={dashboardStats.engagement} />
      </Reveal>

      <Reveal className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
        <div id="pending-comments">
          <PendingCommentsPanel comments={pendingQueue} count={todoCounts.pendingComments} />
        </div>
        <ColumnRule />
        <PopularPostsPanel posts={popularPosts} range={range} />
      </Reveal>
    </div>
  );
}
