import Link from "next/link";
import {
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Eye,
  ImageIcon,
  KeyRound,
} from "lucide-react";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { FallbackImage } from "@/components/admin/ui";
import { getPublicAiModelOptions, type PublicAiModelOption } from "@/lib/ai-models";
import { addUtcDays, formatVisitTrendDate, formatVisitTrendLabel, parseVisitTrendRange, startOfUtcDay, type VisitTrendRange } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";
import { findVisitLogsInRange } from "@/lib/visit-log-repository";

export const dynamic = "force-dynamic";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

const PENDING_COMMENT_STATUS: CommentStatus = "PENDING";

type VisitTrendItem = {
  date: string;
  label: string;
  pv: number;
  uv: number;
};

type VisitTrendSummary = {
  totalPv: number;
  totalUv: number;
  todayPv: number;
  yesterdayPv: number;
};

async function getDraftQueue() {
  return prisma.post.findMany({
    where: { deletedAt: null, published: false },
    select: { id: true, title: true, slug: true, excerpt: true, content: true, updatedAt: true, createdAt: true },
    orderBy: { updatedAt: "desc" },
    take: 3,
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

async function getVisitTrend(range: VisitTrendRange): Promise<{ trend: VisitTrendItem[]; summary: VisitTrendSummary }> {
  const today = startOfUtcDay(new Date());
  const start = addUtcDays(today, -(range - 1));
  const end = addUtcDays(today, 1);
  const yesterday = addUtcDays(today, -1);

  const logs = await findVisitLogsInRange(start, end);

  const buckets = new Map<string, { pv: number; visitors: Set<string> }>();

  for (let index = 0; index < range; index += 1) {
    const date = addUtcDays(start, index);
    buckets.set(formatVisitTrendDate(date), { pv: 0, visitors: new Set<string>() });
  }

  for (const log of logs) {
    const dateKey = formatVisitTrendDate(startOfUtcDay(log.createdAt));
    const bucket = buckets.get(dateKey);
    if (!bucket) continue;

    bucket.pv += 1;
    bucket.visitors.add(log.visitorId || `${log.ipHash ?? "unknown-ip"}:${log.userAgent ?? "unknown-agent"}`);
  }

  const trend = Array.from(buckets.entries()).map(([date, bucket]) => {
    const dateValue = new Date(`${date}T00:00:00.000Z`);
    return {
      date,
      label: formatVisitTrendLabel(dateValue),
      pv: bucket.pv,
      uv: bucket.visitors.size,
    };
  });

  const totalVisitors = new Set<string>();
  for (const log of logs) {
    totalVisitors.add(log.visitorId || `${log.ipHash ?? "unknown-ip"}:${log.userAgent ?? "unknown-agent"}`);
  }

  const todayKey = formatVisitTrendDate(today);
  const yesterdayKey = formatVisitTrendDate(yesterday);

  return {
    trend,
    summary: {
      totalPv: logs.length,
      totalUv: totalVisitors.size,
      todayPv: buckets.get(todayKey)?.pv ?? 0,
      yesterdayPv: buckets.get(yesterdayKey)?.pv ?? 0,
    },
  };
}

type DraftListItem = Awaited<ReturnType<typeof getDraftQueue>>[number];
type PendingCommentListItem = Awaited<ReturnType<typeof getPendingCommentQueue>>[number];
type PopularPostListItem = Awaited<ReturnType<typeof getPopularPosts>>[number];
type AiModelListItem = PublicAiModelOption;

const formatRelativeDate = (value: Date | string | null) => {
  if (!value) return "未发布";

  const date = new Date(value);
  const days = Math.max(0, Math.round((Date.now() - date.getTime()) / 86_400_000));

  if (days === 0) return "更新于 今天";
  if (days === 1) return "更新于 昨天";
  if (days < 7) return `更新于 ${days} 天前`;

  return `更新于 ${date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}`;
};

const getChartGeometry = (trend: VisitTrendItem[]) => {
  const width = 760;
  const height = 238;
  const paddingX = 12;
  const paddingTop = 20;
  const paddingBottom = 30;
  const max = Math.max(10, ...trend.map((item) => item.pv));
  const divisor = Math.max(1, trend.length - 1);
  const points = trend.map((item, index) => {
    const x = paddingX + (index / divisor) * (width - paddingX * 2);
    const y = paddingTop + (1 - item.pv / max) * (height - paddingTop - paddingBottom);
    return { ...item, x, y };
  });
  const linePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1]?.x ?? width} ${height - paddingBottom} L ${points[0]?.x ?? 0} ${height - paddingBottom} Z`
    : "";
  const axisMax = Math.ceil(max / 10) * 10;

  return { width, height, points, linePath, areaPath, axisMax };
};

function formatCompactNumber(value: number) {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : value.toLocaleString("zh-CN");
}

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

function aiModelStatusMeta(status: AiModelListItem["status"]) {
  if (status === "ready") {
    return { label: "可用", tone: "success" as const, icon: CheckCircle2 };
  }

  if (status === "disabled") {
    return { label: "已停用", tone: "neutral" as const, icon: CircleAlert };
  }

  return { label: "缺少密钥", tone: "warning" as const, icon: KeyRound };
}

function aiModelSourceLabel(source: AiModelListItem["source"]) {
  return source === "environment" ? "环境变量" : "数据库";
}

function VisitTrendPanel({ trend, range, summary }: { trend: VisitTrendItem[]; range: VisitTrendRange; summary: VisitTrendSummary }) {
  const chart = getChartGeometry(trend);
  const ranges: VisitTrendRange[] = [7, 30, 90];
  const yAxisValues = [chart.axisMax, Math.round(chart.axisMax * 0.75), Math.round(chart.axisMax * 0.5), Math.round(chart.axisMax * 0.25), 0];

  return (
    <WorkspacePanel
      title="访问趋势"
      actions={
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-[var(--brand)]">
            真实统计
          </span>
          <div className="flex items-center overflow-hidden rounded-lg border border-[var(--border)] text-sm">
            {ranges.map((item, index) => (
              <Link
                key={item}
                href={`/admin?range=${item}`}
                className={`${index === 0 ? "" : "border-l border-[var(--border)]"} px-4 py-2 font-medium ${range === item ? "bg-emerald-50 text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--surface-alt)]"}`}
              >
                {item} 天
              </Link>
            ))}
          </div>
        </div>
      }
      className="min-h-[430px]"
    >
      <dl className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
        <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
          <dt className="text-xs text-[var(--muted)]">区间 PV</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--foreground)]">{summary.totalPv.toLocaleString("zh-CN")}</dd>
        </div>
        <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
          <dt className="text-xs text-[var(--muted)]">区间 UV</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--foreground)]">{summary.totalUv.toLocaleString("zh-CN")}</dd>
        </div>
        <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
          <dt className="text-xs text-[var(--muted)]">今日 PV</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--foreground)]">{summary.todayPv.toLocaleString("zh-CN")}</dd>
        </div>
        <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
          <dt className="text-xs text-[var(--muted)]">昨日 PV</dt>
          <dd className="mt-1 text-xl font-semibold text-[var(--foreground)]">{summary.yesterdayPv.toLocaleString("zh-CN")}</dd>
        </div>
      </dl>
      <div className="flex h-[265px] gap-4 pt-5">
        <div className="flex w-9 flex-col justify-between pb-9 pt-2 text-right text-xs text-[var(--muted)]">
          {yAxisValues.map((value) => <span key={value}>{formatCompactNumber(value)}</span>)}
        </div>
        <svg className="h-full min-w-0 flex-1 overflow-visible" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label={`最近 ${range} 天访问趋势`}>
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
          {chart.areaPath ? <path d={chart.areaPath} fill="url(#visit-area)" /> : null}
          {chart.linePath ? <path d={chart.linePath} fill="none" stroke="#23875f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /> : null}
          {chart.points.map((point) => (
            <g key={point.date}>
              <circle cx={point.x} cy={point.y} fill="#23875f" r="4.2" stroke="#fff" strokeWidth="2" />
              <title>{`${point.date}: PV ${point.pv}, UV ${point.uv}`}</title>
            </g>
          ))}
          {chart.points.map((point, index) => {
            const interval = range > 30 ? 14 : range > 7 ? 5 : 1;
            if (index !== 0 && index !== chart.points.length - 1 && index % interval !== 0) return null;
            return (
              <text key={`${point.date}-label`} x={point.x} y="232" fill="#778178" fontSize="12" textAnchor="middle">
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>
    </WorkspacePanel>
  );
}

function getDraftPreview(post: DraftListItem) {
  const source = post.excerpt?.trim() || post.content.replace(/[#>*_`\-[\]()]/g, " ").replace(/\s+/g, " ").trim();
  return source.length > 120 ? `${source.slice(0, 120)}…` : source || "还没有正文内容。";
}

function RecentDraftsPanel({ drafts }: { drafts: DraftListItem[] }) {
  return (
    <WorkspacePanel title="最近草稿" className="min-h-[430px]">
      {drafts.length > 0 ? (
        <div className="divide-y divide-[var(--border)]">
          {drafts.slice(0, 3).map((post) => (
            <article key={post.id} className="py-4 first:pt-0">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="truncate text-base font-semibold text-[var(--foreground)]">{post.title}</h3>
                <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-[var(--brand)]">草稿</span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--muted)]">{getDraftPreview(post)}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[var(--muted)]">{formatRelativeDate(post.updatedAt ?? post.createdAt)}</p>
                <Link
                  href={`/admin/posts/${post.id}/edit`}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)]"
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
      className="min-h-[460px]"
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
    <WorkspacePanel title="热门文章" className="min-h-[460px]">
      <div className="divide-y divide-[var(--border)]">
        {posts.length > 0 ? (
          posts.map((post, index) => (
            <article key={post.id} className="flex items-center gap-4 py-4 first:pt-0">
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
              <Thumbnail src={post.coverImage} label={`${post.title} 封面`} className="h-16 w-24" />
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

function AiModelChecklistPanel({ models }: { models: AiModelListItem[] }) {
  const visibleModels = models.slice(0, 5);
  const readyCount = models.filter((model) => model.status === "ready").length;
  const summaryLabel = models.length > 0 ? `${readyCount}/${models.length} 可用` : "未配置";

  return (
    <WorkspacePanel
      title="AI 模型清单"
      actions={<span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-[var(--brand)]">{summaryLabel}</span>}
      className="min-h-[460px]"
    >
      {visibleModels.length > 0 ? (
        <ul className="divide-y divide-[var(--border)]">
          {visibleModels.map((model) => {
            const status = aiModelStatusMeta(model.status);
            const StatusIcon = status.icon;
            const isDefaultSummary = model.defaultFor.includes("post-summary");

            return (
              <li key={model.id} className="py-5 first:pt-0">
                <div className="flex items-start gap-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--brand)]">
                    <BrainCircuit className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--foreground)]">{model.name}</h3>
                      {isDefaultSummary ? <StatusBadge tone="success">当前首选</StatusBadge> : null}
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </div>
                    <p className="mt-1 break-all text-sm font-medium text-[var(--foreground)]">{model.model}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--muted)]">
                      {model.description || "未填写模型说明。"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-alt)] px-2.5 py-1">
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {model.hasApiKey ? "密钥已配置" : model.apiKeyEnv}
                      </span>
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1">{aiModelSourceLabel(model.source)}</span>
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1">文章摘要</span>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyPanelMessage>当前没有可用的 AI 模型配置。</EmptyPanelMessage>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {models.length > visibleModels.length ? (
          <p className="text-sm text-[var(--muted)]">还有 {models.length - visibleModels.length} 个模型未显示。</p>
        ) : (
          <span aria-hidden="true" />
        )}
        <Link href="/admin/ai/models" className="inline-flex items-center gap-2 text-sm font-medium text-blue-600">
          管理模型
          <span aria-hidden>→</span>
        </Link>
      </div>
    </WorkspacePanel>
  );
}

export default async function AdminPage({ searchParams }: { searchParams?: Promise<{ range?: string }> } = {}) {
  const resolvedSearchParams = await searchParams;
  const range = parseVisitTrendRange(resolvedSearchParams?.range);
  const [pendingCommentCount, draftQueue, pendingQueue, popularPosts, aiModels, visitTrend] = await Promise.all([
    prisma.comment.count({ where: { deletedAt: null, status: PENDING_COMMENT_STATUS } }),
    getDraftQueue(),
    getPendingCommentQueue(),
    getPopularPosts(),
    getPublicAiModelOptions(),
    getVisitTrend(range),
  ]);

  return (
    <div className="space-y-5 2xl:space-y-6" data-testid="admin-dashboard">
      <section className="grid grid-cols-1 gap-5 2xl:gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(440px,0.75fr)]">
        <VisitTrendPanel trend={visitTrend.trend} range={range} summary={visitTrend.summary} />
        <RecentDraftsPanel drafts={draftQueue} />
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:gap-6 xl:grid-cols-[minmax(360px,1.05fr)_minmax(380px,1.05fr)_minmax(440px,1.15fr)]">
        <PendingCommentsPanel comments={pendingQueue} count={pendingCommentCount} />
        <PopularPostsPanel posts={popularPosts} />
        <AiModelChecklistPanel models={aiModels} />
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5 text-sm text-[var(--muted)]">
        <p>© 2024 roydust.top · 记录与分享技术、生活与思考。</p>
        <p>版本 1.0.0 · 帮助文档 ↗</p>
      </footer>
    </div>
  );
}
