import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const recentPosts = [
  {
    id: "post-1",
    title: "AI Draft",
    slug: "ai-draft",
    published: false,
    createdAt: new Date("2026-04-01T00:00:00Z"),
  },
];

const draftQueuePosts = [
  {
    id: "post-draft-1",
    title: "Queued Draft",
    slug: "queued-draft",
    published: false,
    createdAt: new Date("2026-04-03T00:00:00Z"),
  },
];

const recentComments = [
  {
    id: "comment-1",
    content: "待处理评论内容",
    createdAt: new Date("2026-04-02T00:00:00Z"),
    author: null,
    authorLabel: "匿名访客",
    post: { title: "AI Draft", slug: "ai-draft" },
    status: "PENDING",
  },
];

const pendingQueueComments = [
  {
    id: "comment-pending-1",
    content: "待处理评论内容",
    createdAt: new Date("2026-04-02T00:00:00Z"),
    author: null,
    authorLabel: "匿名访客",
    post: { title: "AI Draft", slug: "ai-draft" },
    status: "PENDING",
  },
];

const postCountMock = vi.fn((whereInput?: { where?: { published?: boolean; publishedAt?: { gte?: Date } } }) => {
  const where = whereInput?.where;
  if (where?.published === false) {
    return Promise.resolve(2);
  }

  if (where?.published === true && where?.publishedAt?.gte instanceof Date) {
    return Promise.resolve(1);
  }

  return Promise.resolve(5);
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      count: postCountMock,
      findMany: vi.fn(({ where }) => {
        if (where?.published === false) {
          return Promise.resolve(draftQueuePosts);
        }

        return Promise.resolve(recentPosts);
      }),
    },
    comment: {
      count: vi.fn().mockResolvedValue(4),
      findMany: vi.fn(({ where }) => {
        if (where?.status === "PENDING") {
          return Promise.resolve(pendingQueueComments);
        }

        return Promise.resolve(recentComments);
      }),
    },
    category: {
      count: vi.fn().mockResolvedValue(3),
    },
    tag: {
      count: vi.fn().mockResolvedValue(2),
    },
  },
}));

describe("admin overview", () => {
  test("renders the editorial home queues and recent changes", async () => {
    const { default: AdminPage } = await import("../page");
    const ui = await AdminPage();

    render(ui as React.ReactElement);

    expect(await screen.findByRole("heading", { name: "编辑部总览" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "待处理工作" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近变更" })).toBeInTheDocument();
    expect(screen.getAllByText("待处理评论").length).toBeGreaterThan(0);
    expect(screen.getByText("Queued Draft")).toBeInTheDocument();
    expect(screen.getAllByText("待处理评论内容").length).toBeGreaterThan(0);
    expect(postCountMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        published: true,
        publishedAt: { gte: expect.any(Date) },
      }),
    });
  });
});
