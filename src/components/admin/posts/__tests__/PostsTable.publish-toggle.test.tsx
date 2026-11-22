import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { TooltipProvider } from "@/components/shadcn/ui/tooltip";

import { PostsTable } from "../PostsTable";
import type { PaginationState, PostRow } from "../hooks/usePostsList";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

function buildPost(id: string, published = false): PostRow {
  return {
    id,
    title: `文章 ${id}`,
    slug: `post-${id}`,
    excerpt: null,
    published,
    viewCount: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    author: { name: "Admin", email: "admin@example.com" },
    _count: { comments: 0, likes: 0 },
  };
}

const pagination: PaginationState = { page: 1, limit: 20, total: 2, totalPages: 1 };

function renderTable(posts: PostRow[], onRequestTogglePublish = vi.fn()) {
  render(
    <TooltipProvider>
      <PostsTable
      busyRowIds={[]}
      headerCheckboxState={false}
      loading={false}
      onOpenDelete={vi.fn()}
      onPageChange={vi.fn()}
      onPageSizeChange={vi.fn()}
      onRequestTogglePublish={onRequestTogglePublish}
      onToggleAll={vi.fn()}
      onToggleOne={vi.fn()}
      pagination={pagination}
      posts={posts}
        visibleSelectedIds={[]}
      />
    </TooltipProvider>,
  );
  return { onRequestTogglePublish };
}

describe("PostsTable 发布切换（仅请求确认，不直接改状态）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("点击草稿行的「发布」只触发 onRequestTogglePublish，不直接发布", () => {
    const { onRequestTogglePublish } = renderTable([buildPost("p1", false)]);

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    expect(onRequestTogglePublish).toHaveBeenCalledTimes(1);
    expect(onRequestTogglePublish).toHaveBeenCalledWith(expect.objectContaining({ id: "p1", published: false }));
  });

  test("点击已发布行的「转草稿」触发 onRequestTogglePublish", () => {
    const { onRequestTogglePublish } = renderTable([buildPost("p2", true)]);

    fireEvent.click(screen.getByRole("button", { name: "切换为草稿" }));

    expect(onRequestTogglePublish).toHaveBeenCalledTimes(1);
    expect(onRequestTogglePublish).toHaveBeenCalledWith(expect.objectContaining({ id: "p2", published: true }));
  });

  test("busy 行按钮禁用，不触发回调", () => {
    const onRequestTogglePublish = vi.fn();
    render(
      <TooltipProvider>
        <PostsTable
          busyRowIds={["p1"]}
        headerCheckboxState={false}
        loading={false}
        onOpenDelete={vi.fn()}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
        onRequestTogglePublish={onRequestTogglePublish}
        onToggleAll={vi.fn()}
        onToggleOne={vi.fn()}
        pagination={pagination}
          posts={[buildPost("p1", false)]}
          visibleSelectedIds={[]}
        />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    expect(onRequestTogglePublish).not.toHaveBeenCalled();
  });
});
