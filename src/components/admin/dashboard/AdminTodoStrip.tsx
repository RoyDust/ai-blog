import Link from "next/link";
import type { ComponentType } from "react";
import { Bot, CheckCircle2, FileClock, MailWarning, MessageSquareWarning } from "lucide-react";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import type { AdminTodoCounts } from "@/lib/admin-stats";

type TodoTone = "warning" | "danger";

type TodoConfig = {
  key: keyof AdminTodoCounts | "aiModels";
  label: string;
  count: number;
  href: string;
  destination: string;
  tone: TodoTone;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  unit?: string;
  showWhenZero?: boolean;
};

type AdminTodoStripProps = {
  counts: AdminTodoCounts;
  showAiModelWarning?: boolean;
};

function formatTodoLabel(count: number, unit = "条") {
  return `${count.toLocaleString("zh-CN")} ${unit}`;
}

export function AdminTodoStrip({ counts, showAiModelWarning = false }: AdminTodoStripProps) {
  const items: TodoConfig[] = [
    {
      key: "pendingComments",
      label: "待审评论",
      count: counts.pendingComments,
      href: "/admin/comments",
      destination: "评论审核",
      tone: "warning",
      icon: MessageSquareWarning,
    },
    {
      key: "failedAiTasks",
      label: "失败 AI 任务",
      count: counts.failedAiTasks,
      href: "/admin/ai/tasks",
      destination: "AI 任务中心",
      tone: "danger",
      icon: Bot,
    },
    {
      key: "staleDrafts",
      label: "滞留草稿",
      count: counts.staleDrafts,
      href: "/admin/posts",
      destination: "文章工作台",
      tone: "warning",
      icon: FileClock,
    },
    {
      key: "pendingNewsletters",
      label: "待处理 Newsletter",
      count: counts.pendingNewsletters,
      href: "/admin/newsletter",
      destination: "Newsletter",
      tone: "warning",
      icon: MailWarning,
    },
    ...(showAiModelWarning
      ? [
          {
            key: "aiModels" as const,
            label: "可用 AI 模型",
            count: 0,
            href: "/admin/ai/models",
            destination: "模型管理",
            tone: "danger" as const,
            icon: Bot,
            unit: "个",
            showWhenZero: true,
          },
        ]
      : []),
  ];
  const visibleItems = items.filter((item) => item.count > 0 || item.showWhenZero);

  if (visibleItems.length === 0) {
    return (
      <section
        aria-label="今日待办"
        className="flex items-center gap-2 rounded-lg bg-[var(--success-surface)] px-4 py-3 text-sm font-semibold text-[var(--success-foreground)]"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>今日无待办</span>
      </section>
    );
  }

  return (
    <section aria-label="今日待办" className="rounded-lg bg-[var(--surface-alt)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const countLabel = formatTodoLabel(item.count, item.unit);

          return (
            <Link
              key={item.key}
              href={item.href}
              aria-label={`${item.label} ${countLabel}，点击进入${item.destination}`}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]"
            >
              <Icon className="h-4 w-4 text-[var(--muted)]" aria-hidden="true" />
              <span>{item.label}</span>
              <StatusBadge tone={item.tone}>{countLabel}</StatusBadge>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
