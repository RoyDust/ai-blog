"use client";

import { Area as RechartsArea, AreaChart as RechartsAreaChart, CartesianGrid as RechartsCartesianGrid, XAxis as RechartsXAxis, YAxis as RechartsYAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/ui/chart";
import type { DashboardStats } from "@/lib/admin-stats";

const visitTrendChartConfig = {
  pv: { label: "PV", color: "#23875f" },
  uv: { label: "UV", color: "#2563eb" },
} satisfies ChartConfig;

const engagementChartConfig = {
  comments: { label: "评论", color: "#d97706" },
  likes: { label: "点赞", color: "#23875f" },
} satisfies ChartConfig;

function formatCompactNumber(value: number) {
  return value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : value.toLocaleString("zh-CN");
}

export function VisitTrendChart({ stats }: { stats: DashboardStats["visits"] }) {
  return (
    <ChartContainer config={visitTrendChartConfig} className="mt-5 h-[265px] w-full" initialDimension={{ width: 760, height: 265 }}>
      <RechartsAreaChart data={stats.trend} margin={{ left: 0, right: 10, top: 12, bottom: 8 }} accessibilityLayer>
        <defs>
          <linearGradient id="visit-pv-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-pv)" stopOpacity={0.24} />
            <stop offset="100%" stopColor="var(--color-pv)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="visit-uv-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-uv)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--color-uv)" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <RechartsCartesianGrid vertical={false} stroke="rgba(23,32,27,0.09)" />
        <RechartsXAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={stats.range > 30 ? 28 : 14} />
        <RechartsYAxis tickFormatter={formatCompactNumber} tickLine={false} axisLine={false} width={38} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <RechartsArea dataKey="uv" type="monotone" stroke="var(--color-uv)" fill="url(#visit-uv-area)" strokeWidth={2} dot={false} />
        <RechartsArea dataKey="pv" type="monotone" stroke="var(--color-pv)" fill="url(#visit-pv-area)" strokeWidth={2.5} dot={false} />
      </RechartsAreaChart>
    </ChartContainer>
  );
}

export function EngagementTrendChart({ stats }: { stats: DashboardStats["engagement"] }) {
  return (
    <ChartContainer config={engagementChartConfig} className="mt-5 h-[180px] w-full" initialDimension={{ width: 420, height: 180 }}>
      <RechartsAreaChart data={stats.trend} margin={{ left: -12, right: 6, top: 8, bottom: 0 }} accessibilityLayer>
        <defs>
          <linearGradient id="engagement-comments-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-comments)" stopOpacity={0.18} />
            <stop offset="100%" stopColor="var(--color-comments)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="engagement-likes-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-likes)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--color-likes)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <RechartsCartesianGrid vertical={false} stroke="rgba(23,32,27,0.09)" />
        <RechartsXAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={stats.range > 30 ? 28 : 16} />
        <RechartsYAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <RechartsArea dataKey="comments" type="monotone" stroke="var(--color-comments)" fill="url(#engagement-comments-area)" strokeWidth={2} dot={false} />
        <RechartsArea dataKey="likes" type="monotone" stroke="var(--color-likes)" fill="url(#engagement-likes-area)" strokeWidth={2} dot={false} />
      </RechartsAreaChart>
    </ChartContainer>
  );
}
