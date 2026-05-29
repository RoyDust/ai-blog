import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AiTaskList } from "../AiTaskList";

const task = {
  id: "task-1",
  type: "post-summary",
  status: "FAILED",
  source: "bulk-posts",
  modelId: "model-1",
  requestedCount: 3,
  succeededCount: 1,
  failedCount: 2,
  startedAt: "2026-05-24T00:00:00.000Z",
  finishedAt: "2026-05-24T00:00:10.000Z",
  createdAt: "2026-05-24T00:00:00.000Z",
  lastError: "timeout",
};

describe("AiTaskList", () => {
  test("renders pagination links while preserving active filters", () => {
    render(
      <AiTaskList
        tasks={[task]}
        pagination={{ page: 2, limit: 20, total: 45, totalPages: 3 }}
        searchParams={{ status: "FAILED", type: "post-summary", limit: "20" }}
      />,
    );

    expect(screen.getByText("显示第 21 到 40 条，共 45 个 AI 任务")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "第 2 页" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute(
      "href",
      "/admin/ai/tasks?status=FAILED&type=post-summary&limit=20",
    );
    expect(screen.getByRole("link", { name: "第 3 页" })).toHaveAttribute(
      "href",
      "/admin/ai/tasks?page=3&status=FAILED&type=post-summary&limit=20",
    );
    expect(screen.getByRole("link", { name: "下一页" })).toHaveAttribute(
      "href",
      "/admin/ai/tasks?page=3&status=FAILED&type=post-summary&limit=20",
    );
  });
});
