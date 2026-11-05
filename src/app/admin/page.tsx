import { AdminTodoStrip } from "@/components/admin/dashboard/AdminTodoStrip";
import {
  ColumnRule,
  DashboardDateMeta,
  DashboardHealthMetrics,
  EngagementStatsPanel,
  PendingCommentsPanel,
  PopularPostsPanel,
  ReadingStatsPanel,
  RecentDraftsPanel,
  VisitTrendPanel,
} from "@/components/admin/dashboard/DashboardPanels";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Reveal } from "@/components/editorial";
import {
  getAdminStatsRangeWindow,
  getAdminTodoCounts,
  getDashboardStatsWithComparison,
  parseAdminStatsRange,
} from "@/lib/admin-stats";
import { getPublicAiModelOptions } from "@/lib/ai-models";
import type { VisitTrendRange } from "@/lib/analytics";
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
        meta={<DashboardDateMeta now={now} />}
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
