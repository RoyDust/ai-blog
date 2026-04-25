import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { BulkAiCompletionDialog } from "../BulkAiCompletionDialog";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BulkAiCompletionDialog", () => {
  test("starts a batch AI completion task for selected posts", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: "task-1",
          items: [{ id: "item-1" }],
        },
      }),
    });
    const onStarted = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    render(<BulkAiCompletionDialog open selectedIds={["post-1", "post-2"]} onClose={vi.fn()} onStarted={onStarted} />);

    fireEvent.click(screen.getByRole("button", { name: "开始补全" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai/batch",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body).toMatchObject({
      postIds: ["post-1", "post-2"],
      actions: ["summary", "seo-description"],
      mode: "missing-only",
      apply: true,
    });
    expect(onStarted).toHaveBeenCalledWith("task-1");
    expect(await screen.findByText("查看详情")).toHaveAttribute("href", "/admin/ai/tasks/task-1");
  });
});
