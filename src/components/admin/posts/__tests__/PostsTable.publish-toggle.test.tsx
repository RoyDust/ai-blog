import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { TooltipProvider } from "@/components/shadcn/ui/tooltip";

import { PostsTable } from "../PostsTable";
import type { PaginationState, PostRow } from "../hooks/usePostsList";

vi.mock("next/link", () => ({
  default: ({ href, children, className, title }: { href: string; children: ReactNode; className?: string; title?: string }) => (
    <a href={href} className={className} title={title}>{children}</a>
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

describe("PostsTable 单行写法与勾选（方向 A 状态画板 A）", () => {
  function renderWith(posts: PostRow[], options: { selected?: string[]; header?: boolean | "indeterminate"; loading?: boolean } = {}) {
    return render(
      <TooltipProvider>
        <PostsTable
          busyRowIds={[]}
          headerCheckboxState={options.header ?? false}
          loading={options.loading ?? false}
          onOpenDelete={vi.fn()}
          onPageChange={vi.fn()}
          onPageSizeChange={vi.fn()}
          onRequestTogglePublish={vi.fn()}
          onToggleAll={vi.fn()}
          onToggleOne={vi.fn()}
          pagination={pagination}
          posts={posts}
          visibleSelectedIds={options.selected ?? []}
        />
      </TooltipProvider>,
    );
  }

  test("表头半选、勾选行高亮；slug 只在标题悬停提示里出现，作者只显示名字", () => {
    const { container } = renderWith([buildPost("p1"), buildPost("p2")], { selected: ["p1"], header: "indeterminate" });

    const header = screen.getByLabelText("选择当前页") as HTMLInputElement;
    expect(header.indeterminate).toBe(true);
    expect(header).toHaveAttribute("aria-checked", "mixed");
    expect(screen.getByLabelText("选择 p1")).toBeChecked();
    expect(container.querySelector('tr[data-state="selected"]')).toHaveTextContent("文章 p1");

    expect(screen.getByRole("link", { name: "文章 p1" })).toHaveAttribute("title", "/posts/post-p1");
    expect(screen.queryByText("/posts/post-p1")).not.toBeInTheDocument();
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0);
    expect(screen.queryByText("admin@example.com")).not.toBeInTheDocument();
  });

  test("没有 slug 时预览置灰，悬停提示「缺少 slug」", async () => {
    renderWith([{ ...buildPost("p3"), slug: "" }]);

    const preview = screen.getByRole("button", { name: "预览" });
    expect(preview).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("link", { name: "文章 p3" })).toHaveAttribute("title", "未设置 slug");

    fireEvent.focus(preview);
    expect((await screen.findAllByText("缺少 slug")).length).toBeGreaterThan(0);
  });

  test("AI 摘要失败时同一行显示错误原因；加载时保留表头显示骨架", () => {
    const { unmount } = renderWith([{ ...buildPost("p4"), summaryStatus: "FAILED", summaryError: "模型返回超时（30s）" }]);
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("模型返回超时（30s）")).toBeInTheDocument();
    unmount();

    renderWith([], { loading: true });
    expect(screen.getByRole("columnheader", { name: "标题" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("正在加载文章");
  });
});
