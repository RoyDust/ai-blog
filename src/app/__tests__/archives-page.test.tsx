import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "p2",
          title: "New Post",
          slug: "new-post",
          createdAt: new Date("2026-03-01T08:00:00Z"),
          excerpt: "latest",
          generatedByAiNews: false,
          category: { name: "前端", slug: "frontend" },
        },
        {
          id: "p1",
          title: "Old Post",
          slug: "old-post",
          createdAt: new Date("2025-12-01T08:00:00Z"),
          excerpt: "older",
          generatedByAiNews: true,
          category: { name: "后端", slug: "backend" },
        },
      ]),
    },
  },
}));

describe("archives page", () => {
  test("renders timeline with latest posts first and filters original vs AI daily", async () => {
    const { default: ArchivesPage } = await import("@/app/(public)/archives/page");
    const ui = await ArchivesPage();

    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "文章归档" })).toBeInTheDocument();
    expect(container.querySelector(".reader-banner")).toBeInTheDocument();
    expect(container.querySelector(".reader-feed-card")).toBeInTheDocument();

    const links = container.querySelectorAll('a[href^="/posts/"]');
    expect(links[0]).toHaveTextContent("New Post");
    expect(links[1]).toHaveTextContent("Old Post");

    fireEvent.click(screen.getByRole("button", { name: /原创文章/ }));
    expect(screen.getByText("New Post")).toBeInTheDocument();
    expect(screen.queryByText("Old Post")).not.toBeInTheDocument();
  });
});
