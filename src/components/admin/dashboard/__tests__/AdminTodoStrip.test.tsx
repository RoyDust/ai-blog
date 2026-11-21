import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { AdminTodoStrip } from "../AdminTodoStrip";
import type { AdminTodoCounts } from "@/lib/admin-stats";

const zeroCounts: AdminTodoCounts = {
  pendingComments: 0,
  failedAiTasks: 0,
  staleDrafts: 0,
  pendingNewsletters: 0,
};

describe("AdminTodoStrip", () => {
  test("renders actionable todo links with counts and accessible labels", () => {
    render(
      <AdminTodoStrip
        counts={{
          pendingComments: 3,
          failedAiTasks: 2,
          staleDrafts: 1,
          pendingNewsletters: 4,
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "待审评论 3 条，点击进入评论审核" })).toHaveAttribute("href", "/admin/comments");
    expect(screen.getByRole("link", { name: "失败 AI 任务 2 条，点击进入AI 任务中心" })).toHaveAttribute("href", "/admin/ai/tasks");
    expect(screen.getByRole("link", { name: "滞留草稿 1 条，点击进入文章工作台" })).toHaveAttribute("href", "/admin/posts");
    expect(screen.getByRole("link", { name: "待处理 Newsletter 4 条，点击进入Newsletter" })).toHaveAttribute("href", "/admin/newsletter");
    // 一行文字链接：计数等宽、按语气着色（失败 AI 任务 danger，其余 warning）
    expect(screen.getByRole("link", { name: /待审评论/ })).toHaveTextContent("待审评论3 条");
    expect(screen.getByText("3")).toHaveClass("font-mono", "text-[var(--warning)]");
    expect(screen.getByText("2")).toHaveClass("font-mono", "text-[var(--danger-foreground)]");
    expect(screen.getByText("1")).toHaveClass("text-[var(--warning)]");
    expect(screen.getByText("4")).toHaveClass("text-[var(--warning)]");
  });

  test("collapses to a single zero-state row when there is no work", () => {
    render(<AdminTodoStrip counts={zeroCounts} />);

    expect(screen.getByRole("region", { name: "今日待办" })).toBeInTheDocument();
    expect(screen.getByText("今日无待办")).toHaveClass("text-[var(--success)]");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("can surface a zero available AI model warning", () => {
    render(<AdminTodoStrip counts={zeroCounts} showAiModelWarning />);

    expect(screen.getByRole("link", { name: "可用 AI 模型 0 个，点击进入模型管理" })).toHaveAttribute("href", "/admin/ai/models");
    expect(screen.queryByText("今日无待办")).not.toBeInTheDocument();
  });
});
