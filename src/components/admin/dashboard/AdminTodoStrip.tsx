import Link from "next/link";
import { Fragment } from "react";

import type { AdminTodoCounts } from "@/lib/admin-stats";

type TodoTone = "warning" | "danger";

type TodoConfig = {
  key: keyof AdminTodoCounts | "aiModels";
  label: string;
  count: number;
  href: string;
  destination: string;
  tone: TodoTone;
  unit?: string;
  showWhenZero?: boolean;
};

type AdminTodoStripProps = {
  counts: AdminTodoCounts;
  showAiModelWarning?: boolean;
};

const toneClassName: Record<TodoTone, string> = {
  warning: "text-[var(--warning)]",
  danger: "text-[var(--danger-foreground)]",
};

function formatTodoLabel(count: number, unit = "条") {
  return `${count.toLocaleString("zh-CN")} ${unit}`;
}

/**
 * 今日待办（方向 A）：一行文字链接，计数等宽并按语气着色，项与项之间 1px 竖线；
 * 全部清零时整行换成 success 色「今日无待办」。
 */
export function AdminTodoStrip({ counts, showAiModelWarning = false }: AdminTodoStripProps) {
  const items: TodoConfig[] = [
    {
      key: "pendingComments",
      label: "待审评论",
      count: counts.pendingComments,
      href: "/admin/comments",
      destination: "评论审核",
      tone: "warning",
    },
    {
      key: "failedAiTasks",
      label: "失败 AI 任务",
      count: counts.failedAiTasks,
      href: "/admin/ai/tasks",
      destination: "AI 任务中心",
      tone: "danger",
    },
    {
      key: "staleDrafts",
      label: "滞留草稿",
      count: counts.staleDrafts,
      href: "/admin/posts",
      destination: "文章工作台",
      tone: "warning",
    },
    {
      key: "pendingNewsletters",
      label: "待处理 Newsletter",
      count: counts.pendingNewsletters,
      href: "/admin/newsletter",
      destination: "Newsletter",
      tone: "warning",
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
            unit: "个",
            showWhenZero: true,
          },
        ]
      : []),
  ];
  const visibleItems = items.filter((item) => item.count > 0 || item.showWhenZero);

  return (
    <section
      aria-label="今日待办"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--border)] py-2.5"
      data-testid="admin-todo-strip"
    >
      <h2 className="mr-2 text-[0.8125rem] font-bold tracking-[0.08em] text-[var(--foreground)]">今日待办</h2>

      {visibleItems.length === 0 ? (
        <p className="flex min-h-8 flex-wrap items-center gap-x-4 text-[0.875rem]">
          <span className="font-bold text-[var(--success)]">今日无待办</span>
          <span className="text-[var(--text-muted)]">评论、AI 任务、草稿与 Newsletter 都已处理完。</span>
        </p>
      ) : (
        visibleItems.map((item, index) => {
          const countLabel = formatTodoLabel(item.count, item.unit);

          return (
            <Fragment key={item.key}>
              {index > 0 ? <span aria-hidden="true" className="h-4 w-px bg-[var(--border)]" /> : null}
              <Link
                aria-label={`${item.label} ${countLabel}，点击进入${item.destination}`}
                className="group inline-flex min-h-8 items-center gap-1.5 text-[0.875rem] text-[var(--text-body)] transition-colors duration-150 hover:text-[var(--foreground)]"
                href={item.href}
              >
                <span>{item.label}</span>
                <span>
                  <span className={`font-mono font-bold tabular-nums ${toneClassName[item.tone]}`}>{item.count.toLocaleString("zh-CN")}</span>{" "}
                  {item.unit ?? "条"}
                </span>
                <span
                  aria-hidden="true"
                  className="text-[var(--text-muted)] transition-transform duration-200 group-hover:translate-x-[3px] motion-reduce:transition-none"
                >
                  →
                </span>
              </Link>
            </Fragment>
          );
        })
      )}
    </section>
  );
}
