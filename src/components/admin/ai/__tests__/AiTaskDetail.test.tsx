import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AiTaskDetail } from "../AiTaskDetail";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function buildTask(overrides: Partial<Parameters<typeof AiTaskDetail>[0]["task"]> = {}) {
  return {
    id: "task-1",
    type: "post-article-info",
    status: "SUCCEEDED",
    source: "single-post",
    modelId: "model-1",
    requestedCount: 1,
    succeededCount: 1,
    failedCount: 0,
    startedAt: "2026-05-24T00:00:00.000Z",
    finishedAt: "2026-05-24T00:00:01.000Z",
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:01.000Z",
    lastError: null,
    metadata: { oneClick: true },
    createdBy: { name: "Admin", email: "admin@example.com" },
    items: [
      {
        id: "item-1",
        postId: "post-1",
        action: "slug",
        status: "SUCCEEDED",
        output: { slug: "ai-generated-info" },
        applied: false,
        error: null,
        startedAt: "2026-05-24T00:00:00.000Z",
        finishedAt: "2026-05-24T00:00:01.000Z",
        updatedAt: "2026-05-24T00:00:01.000Z",
        post: {
          id: "post-1",
          title: "文章标题",
          slug: "old-title",
          excerpt: null,
          seoDescription: null,
        },
      },
    ],
    ...overrides,
  };
}

describe("AiTaskDetail", () => {
  test("shows one-click article info items as form-filled instead of directly applicable", () => {
    render(<AiTaskDetail task={buildTask()} />);

    expect(screen.getByText("待表单确认")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "文章信息结果" })).toBeInTheDocument();
    expect(screen.getAllByText("ai-generated-info").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "应用" })).not.toBeInTheDocument();
  });

  test("disables retry for failed one-click article info tasks", () => {
    render(
      <AiTaskDetail
        task={buildTask({
          status: "PARTIAL_FAILED",
          source: "draft-post",
          succeededCount: 0,
          failedCount: 1,
          items: [
            {
              id: "item-1",
              postId: null,
              action: "slug",
              status: "FAILED",
              output: null,
              applied: false,
              error: "Slug failed",
              startedAt: "2026-05-24T00:00:00.000Z",
              finishedAt: "2026-05-24T00:00:01.000Z",
              updatedAt: "2026-05-24T00:00:01.000Z",
              post: null,
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: "回编辑器重试" })).toBeDisabled();
    expect(screen.getByText("一键文章信息任务不会在任务中心直接写库；请回到文章编辑器确认可用结果或重新生成失败项。")).toBeInTheDocument();
  });
});
