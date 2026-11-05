"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import {
  Bar as RechartsBar,
  BarChart as RechartsBarChart,
  CartesianGrid as RechartsCartesianGrid,
  Line as RechartsLine,
  LineChart as RechartsLineChart,
  ReferenceLine as RechartsReferenceLine,
  XAxis as RechartsXAxis,
  YAxis as RechartsYAxis,
} from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/shadcn/ui/chart";
import { editorialEase } from "@/components/editorial";
import type { DashboardStats } from "@/lib/admin-stats";

/**
 * 后台首页图表（方向 A）：只留 1px 网格线，不用面积渐变；
 * 第一序列 foreground 实线，第二序列 --chart2 虚线（亮色 focus 色、暗色 sky）；柱状图方角细柱；
 * 坐标轴文字等宽 11px；「今日」用一条虚竖线标出。
 */
const visitTrendChartConfig = {
  pv: { label: "浏览量 PV", color: "var(--foreground)" },
  uv: { label: "访客 UV", color: "var(--chart2)" },
} satisfies ChartConfig;

const engagementChartConfig = {
  comments: { label: "评论", color: "var(--foreground)" },
  likes: { label: "点赞", color: "var(--chart2)" },
} satisfies ChartConfig;

const TODAY_LABEL = "今日";
const axisTick = { fontSize: 11, fill: "var(--text-muted)" };
// 坐标轴文字统一等宽（SVG 属性里不写 var()，交给 CSS）
const chartContainerClassName = "w-full aspect-auto [&_.recharts-cartesian-axis-tick_text]:font-mono [&_text]:font-mono";
const tooltipClassName = "font-sans";

function formatCompactNumber(value: number) {
  return value >= 10_000 ? `${Number((value / 1000).toFixed(1))}K` : String(value);
}

/** 把最后一个桶（今天）的横轴标签写成「今日」 */
function withTodayLabel<T extends { label: string }>(trend: T[]) {
  return trend.map((item, index) => (index === trend.length - 1 ? { ...item, axisLabel: TODAY_LABEL } : { ...item, axisLabel: item.label }));
}

function TodayTick({ x, y, payload }: { x?: number | string; y?: number | string; payload?: { value?: string } }) {
  const isToday = payload?.value === TODAY_LABEL;
  return (
    <text
      dy={14}
      fontSize={11}
      style={{ fill: isToday ? "var(--foreground)" : "var(--text-muted)" }}
      textAnchor="middle"
      x={Number(x ?? 0)}
      y={Number(y ?? 0)}
    >
      {payload?.value}
    </text>
  );
}

/** 图表淡入（减少动态效果时直接显示） */
function ChartFade({ children, className }: { children: ReactNode; className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0 }}
      transition={{ duration: 0.5, ease: editorialEase }}
      viewport={{ once: true, amount: 0.2 }}
      whileInView={{ opacity: 1 }}
    >
      {children}
    </motion.div>
  );
}

/** 图例：实线 / 虚线 / 方块 + muted 小字 */
export function ChartLegend({ items }: { items: Array<{ label: string; color: string; mark: "line" | "dashed" | "square" }> }) {
  return (
    <ul className="flex justify-end gap-4 text-xs text-[var(--text-muted)]">
      {items.map((item) => (
        <li className="flex items-center gap-1.5" key={item.label}>
          {item.mark === "square" ? (
            <span aria-hidden="true" className="size-2" style={{ background: item.color }} />
          ) : (
            <span
              aria-hidden="true"
              className="w-4 border-t-[1.5px]"
              style={{ borderColor: item.color, borderStyle: item.mark === "dashed" ? "dashed" : "solid" }}
            />
          )}
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function VisitTrendChart({ stats }: { stats: DashboardStats["visits"] }) {
  const reduceMotion = useReducedMotion();
  const data = withTodayLabel(stats.trend);

  return (
    <ChartFade>
      <div className="pt-3.5 pb-2">
        <ChartLegend
          items={[
            { label: "浏览量 PV", color: "var(--foreground)", mark: "line" },
            { label: "访客 UV", color: "var(--chart2)", mark: "dashed" },
          ]}
        />
      </div>
      <ChartContainer
        aria-label={`近 ${stats.range} 天浏览量与访客趋势`}
        className={`h-[260px] ${chartContainerClassName}`}
        config={visitTrendChartConfig}
        initialDimension={{ width: 760, height: 260 }}
        role="img"
      >
        <RechartsLineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 4 }} accessibilityLayer>
          <RechartsCartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <RechartsXAxis
            axisLine={{ stroke: "var(--reader-border-strong)" }}
            dataKey="axisLabel"
            interval="preserveStartEnd"
            minTickGap={stats.range > 30 ? 28 : 14}
            tick={<TodayTick />}
            tickLine={false}
          />
          <RechartsYAxis axisLine={false} tick={axisTick} tickFormatter={formatCompactNumber} tickLine={false} width={44} />
          <ChartTooltip
            content={<ChartTooltipContent className={tooltipClassName} indicator="line" />}
            cursor={{ stroke: "var(--reader-border-strong)", strokeWidth: 1 }}
          />
          <RechartsReferenceLine stroke="var(--reader-border-strong)" strokeDasharray="2 3" x={TODAY_LABEL} />
          <RechartsLine
            animationDuration={700}
            dataKey="uv"
            dot={false}
            isAnimationActive={!reduceMotion}
            stroke="var(--color-uv)"
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeWidth={1.5}
            type="linear"
          />
          <RechartsLine
            activeDot={{ r: 3, fill: "var(--foreground)", stroke: "var(--card-bg)", strokeWidth: 1.5 }}
            animationDuration={700}
            dataKey="pv"
            dot={false}
            isAnimationActive={!reduceMotion}
            stroke="var(--color-pv)"
            strokeLinejoin="round"
            strokeWidth={1.5}
            type="linear"
          />
        </RechartsLineChart>
      </ChartContainer>
    </ChartFade>
  );
}

export function EngagementTrendChart({ stats }: { stats: DashboardStats["engagement"] }) {
  const reduceMotion = useReducedMotion();
  const data = withTodayLabel(stats.trend);

  return (
    <ChartFade>
      <div className="pt-3.5 pb-2">
        <ChartLegend
          items={[
            { label: "评论", color: "var(--foreground)", mark: "square" },
            { label: "点赞", color: "var(--chart2)", mark: "square" },
          ]}
        />
      </div>
      <ChartContainer
        aria-label={`近 ${stats.range} 天评论与点赞趋势`}
        className={`h-[170px] ${chartContainerClassName}`}
        config={engagementChartConfig}
        initialDimension={{ width: 420, height: 170 }}
        role="img"
      >
        <RechartsBarChart barCategoryGap="30%" barGap={6} data={data} margin={{ left: 0, right: 4, top: 6, bottom: 0 }} accessibilityLayer>
          <RechartsCartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <RechartsXAxis
            axisLine={{ stroke: "var(--reader-border-strong)" }}
            dataKey="axisLabel"
            interval="preserveStartEnd"
            minTickGap={stats.range > 30 ? 28 : 12}
            tick={<TodayTick />}
            tickLine={false}
          />
          <RechartsYAxis allowDecimals={false} axisLine={false} tick={axisTick} tickLine={false} width={32} />
          <ChartTooltip
            content={<ChartTooltipContent className={tooltipClassName} />}
            cursor={{ fill: "color-mix(in oklab, var(--foreground) 4%, transparent)" }}
          />
          <RechartsBar animationDuration={600} dataKey="comments" fill="var(--color-comments)" isAnimationActive={!reduceMotion} maxBarSize={6} radius={0} />
          <RechartsBar animationDuration={600} dataKey="likes" fill="var(--color-likes)" isAnimationActive={!reduceMotion} maxBarSize={6} radius={0} />
        </RechartsBarChart>
      </ChartContainer>
    </ChartFade>
  );
}
