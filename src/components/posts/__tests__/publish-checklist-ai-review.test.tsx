import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PublishChecklist } from "@/components/posts/PublishChecklist";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("publish checklist AI review", () => {
  test("requests AI review and renders the report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          verdict: "needs-work",
          score: 72,
          summary: "文章方向清晰，但发布前需要补充结论和封面。",
          checks: [{ label: "结构", status: "warn", detail: "缺少收束段" }],
          suggestions: ["补充结论", "增加封面图"],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <PublishChecklist
        title="Next.js AI 审稿实践"
        slug="nextjs-ai-review"
        content={"# 正文\n\n" + "这是一段文章内容。".repeat(30)}
        coverImage=""
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "AI 审稿" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/posts/review",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("AI 审稿：需要修改 · 72 分")).toBeInTheDocument();
    expect(screen.getByText("文章方向清晰，但发布前需要补充结论和封面。")).toBeInTheDocument();
    expect(screen.getByText("结构：缺少收束段")).toBeInTheDocument();
    expect(screen.getByText("补充结论")).toBeInTheDocument();
  });
});
