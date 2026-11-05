"use client";
// 临时预览页（a13 视觉自检用，完成后删除）
import { AdminLayout } from "@/components/admin/shell/AdminLayout";
import { AdminTodoStrip } from "@/components/admin/dashboard/AdminTodoStrip";
import { ColumnRule, DashboardDateMeta, DashboardHealthMetrics, EngagementStatsPanel, PendingCommentsPanel, PopularPostsPanel, ReadingStatsPanel, RecentDraftsPanel, VisitTrendPanel } from "@/components/admin/dashboard/DashboardPanels";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Button } from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { useState } from "react";

const days = ["10-15","10-16","10-17","10-18","10-19","10-20","10-21"];
const visits = { range: 7 as const, hasData: true, trend: days.map((d,i)=>({date:d,label:d,pv:[1600,1750,2240,1980,1990,1870,1032][i],uv:[420,450,560,500,505,490,280][i]})), summary:{totalPv:12500,totalUv:3206,todayPv:1032,yesterdayPv:1876} };
const reading = { range: 7 as const, hasData: true, trend: [], summary:{ totalEvents:1364, qualifiedEvents:846, completedEvents:312, totalDurationSeconds:110520, averageDurationSeconds:131 } };
const engagement = { range: 7 as const, hasData: true, trend: days.map((d,i)=>({date:d,label:d,comments:[3,6,4,8,5,7,4][i],likes:[12,15,14,22,17,18,11][i]})), summary:{comments:58,likes:156,total:214} };
const comparison = { current:{range:7 as const, visits, reading, engagement}, previous:{range:7 as const, visits, reading, engagement}, metrics:{publishedPosts:6, readingMinutes:1842, engagementRate:0.048, subscribers:18}, previousMetrics:{publishedPosts:4, readingMinutes:1628, engagementRate:0.054, subscribers:13}, deltas:{visits:10, publishedPosts:2, readingMinutes:214, engagementRate:-0.006, subscribers:5} };
const now = new Date();
const drafts = [
  { id:"a", title:"前端可观测性：从埋点到告警", excerpt:"这一篇想把埋点、日志和告警串成一条链路：先说清楚要观测什么，再决定在哪一层采集，最后才是告警阈值。", content:"", updatedAt:new Date(Date.now()-3*3600e3), createdAt:new Date() },
  { id:"b", title:"API 设计：版本演进如何不破坏老客户端", excerpt:"版本号放在路径里还是请求头里？比起选哪一种，更重要的是废弃策略和兼容窗口要写进文档。", content:"", updatedAt:new Date(Date.now()-26*3600e3), createdAt:new Date() },
];
const comments = [{ id:"c1", content:"缓存那一节很有用，想问一下 pnpm store 放在 runner 本地还是对象存储？", createdAt:new Date(Date.now()-12*60e3), authorLabel:"林舟", author:null, post:{title:"把 CI/CD 流水线从 20 分钟压到 6 分钟", slug:"x"} }];
const popular = [1,2,3,4,5].map((i)=>({ id:String(i), title:["把 CI/CD 流水线从 20 分钟压到 6 分钟","页面性能优化：先找到真正的瓶颈","测试金字塔在前端还成立吗","写在开始：为什么要重新做一个博客","产品与体验：内容型页面为什么需要节奏感"][i-1], slug:"x", coverImage:null, visitCount:[2318,1904,1277,986,742][i-1] }));
const rows = Array.from({length:12},(_,i)=>({id:String(i+1), name:`第 ${i+1} 篇文章标题，用来看单行截断与行高`, status:i%3===0?"草稿":"已发布"}));

export default function Preview() {
  const [open, setOpen] = useState(false);
  return (
    <AdminLayout siteName="依尘の博客" user={{ label: "依尘", role: "ADMIN" }}>
      <div>
        <PageHeader eyebrow="后台首页" meta={<DashboardDateMeta now={now} />} title="今日概览" action={<Button onClick={() => setOpen(true)}>危险确认</Button>} />
        <AdminTodoStrip counts={{pendingComments:12, failedAiTasks:2, staleDrafts:5, pendingNewsletters:1}} />
        <DashboardHealthMetrics comparison={comparison} />
        <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 xl:grid-cols-[minmax(0,1.45fr)_1px_minmax(400px,0.75fr)]">
          <VisitTrendPanel stats={visits} />
          <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] xl:block" />
          <RecentDraftsPanel drafts={drafts} />
        </div>
        <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
          <ReadingStatsPanel stats={reading} />
          <ColumnRule />
          <EngagementStatsPanel stats={engagement} />
        </div>
        <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
          <PendingCommentsPanel comments={comments} count={12} />
          <ColumnRule />
          <PopularPostsPanel posts={popular} range={7} />
        </div>
        <div className="mt-9">
          <DataTable title="文章列表" summary="发布状态、AI 摘要和数据上下文" rows={rows} emptyText="暂无" bulkActions={[{label:"批量发布", onClick:()=>{}},{label:"批量删除", onClick:()=>{}, variant:"danger"}]} columns={[{key:"name",label:"标题",render:(r)=> <span className="font-serif font-bold text-[var(--foreground)]">{r.name}</span>},{key:"status",label:"状态",render:(r)=>r.status}]} />
        </div>
        <div id="empty-board" className="mt-16">
          <AdminTodoStrip counts={{pendingComments:0, failedAiTasks:0, staleDrafts:0, pendingNewsletters:0}} />
          <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 xl:grid-cols-[minmax(0,1.45fr)_1px_minmax(400px,0.75fr)]">
            <VisitTrendPanel stats={{...visits, hasData:false, trend: visits.trend.map((t)=>({...t,pv:0,uv:0})), summary:{totalPv:0,totalUv:0,todayPv:0,yesterdayPv:0}}} />
            <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] xl:block" />
            <RecentDraftsPanel drafts={[]} />
          </div>
          <div className="mt-9 grid grid-cols-1 gap-x-7 gap-y-9 lg:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
            <ReadingStatsPanel stats={{...reading, hasData:false}} />
            <ColumnRule />
            <PopularPostsPanel posts={[]} range={7} />
          </div>
          <div className="mt-9"><DataTable title="加载中表格" rows={[]} isLoading emptyText="暂无" columns={[{key:"a",label:"标题",render:()=>null}]} /></div>
          <div className="mt-9"><DataTable title="空表格" rows={[]} emptyText="还没有文章，先写第一篇。" columns={[{key:"a",label:"标题",render:()=>null}]} /></div>
        </div>
        <ConfirmDialog open={open} onOpenChange={setOpen} title="删除文章「前端可观测性」？" description="删除后文章从前台下线，可在回收站恢复。" tone="danger" confirmLabel="确认删除" impacts={<p>关联评论 3 条</p>} onConfirm={() => setOpen(false)} />
      </div>
    </AdminLayout>
  );
}
