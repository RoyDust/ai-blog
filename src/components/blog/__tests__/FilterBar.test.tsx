import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { FilterBar } from "../FilterBar";

test("filter bar renders removable conditions by display name and a reset entry when filters are present", () => {
  const { container } = render(
    <FilterBar
      search="react"
      category="frontend"
      tag="nextjs"
      total={12}
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  // 报头：衬线 h1 + 等宽状态行，下方 2px 粗线
  expect(screen.getByRole("heading", { level: 1, name: "全部文章" })).toHaveClass("ed-serif");
  expect(screen.getByText(/共 12/)).toHaveClass("ed-mono");
  expect(screen.getByText("按发布时间")).toBeInTheDocument();
  expect(container.querySelector("hr.ed-rule-strong")).not.toBeNull();

  // 已选条件显示名称（不是 slug），点击即移除对应条件
  const keyword = screen.getByRole("link", { name: "移除关键词：react" });
  expect(keyword).toHaveAttribute("href", "/posts?category=frontend&tag=nextjs");
  expect(keyword).toHaveTextContent("关键词react");
  const category = screen.getByRole("link", { name: "移除分类：Frontend" });
  expect(category).toHaveAttribute("href", "/posts?q=react&tag=nextjs");
  expect(category).toHaveTextContent("分类Frontend");
  expect(category).not.toHaveTextContent("frontend");
  const tag = screen.getByRole("link", { name: "移除标签：Next.js" });
  expect(tag).toHaveAttribute("href", "/posts?q=react&category=frontend");
  expect(tag).toHaveTextContent("标签Next.js");
  // × 图标只做装饰
  expect(tag.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  // 不再是药丸 chip
  expect(tag.className).not.toContain("reader-chip");
  expect(tag.className).not.toContain("rounded-full");

  const reset = screen.getByRole("link", { name: "清空筛选" });
  expect(reset).toHaveAttribute("href", "/posts");
  expect(reset).toHaveClass("ed-link");

  // 桌面表单：两个下拉 + 描边「应用筛选」，不吸顶
  const desktopForm = screen.getByRole("form", { name: "筛选文章" });
  expect(desktopForm).not.toHaveClass("sticky");
  expect(desktopForm).not.toHaveClass("z-30");
  expect(screen.getByRole("combobox", { name: "分类筛选" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "标签筛选" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "应用筛选" })).toHaveClass("ed-btn-outline");
  expect(container.querySelector<HTMLInputElement>('input[name="q"]')?.value).toBe("react");
});

test("falls back to the slug when a selected condition is missing from the directory", () => {
  render(<FilterBar category="ghost" categories={[]} tags={[]} />);

  expect(screen.getByRole("link", { name: "移除分类：ghost" })).toHaveAttribute("href", "/posts");
});

test("filter bar hides the condition row without active filters", () => {
  render(<FilterBar categories={[{ name: "Frontend", slug: "frontend" }]} tags={[]} title="搜索结果" />);

  expect(screen.getByRole("heading", { level: 1, name: "搜索结果" })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "清空筛选" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /^移除/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "筛选" })).toHaveTextContent(/^筛选$/);
});

test("mobile filter toggle shows the active count and expands an in-place panel", async () => {
  render(
    <FilterBar
      category="frontend"
      tag="nextjs"
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  const toggle = screen.getByRole("button", { name: "筛选 2" });
  expect(toggle).toHaveClass("ed-btn-outline", "sm:hidden");
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.getAllByRole("form", { name: "筛选文章" })).toHaveLength(1);
  expect(screen.queryByText("选好后点「应用筛选」")).not.toBeInTheDocument();

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const panelId = toggle.getAttribute("aria-controls");
  expect(panelId).toBeTruthy();
  const panel = document.getElementById(panelId!);
  expect(panel).not.toBeNull();
  expect(panel).toHaveClass("sm:hidden");
  expect(within(panel!).getByText("选好后点「应用筛选」")).toBeInTheDocument();
  expect(within(panel!).getByRole("button", { name: "应用筛选" })).toHaveClass("ed-btn-outline", "ed-btn--block");
  expect(within(panel!).getByRole("combobox", { name: "分类筛选" })).toBeInTheDocument();
  expect(panel!.querySelector<HTMLInputElement>('input[name="category"]')?.value).toBe("frontend");
  expect(panel!.querySelector<HTMLInputElement>('input[name="tag"]')?.value).toBe("nextjs");

  fireEvent.click(toggle);

  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await waitFor(() => {
    expect(screen.queryByText("选好后点「应用筛选」")).not.toBeInTheDocument();
  });
});

test("filter bar resyncs selected values when filter props change", () => {
  const { container, rerender } = render(
    <FilterBar
      search="react"
      category="frontend"
      tag="nextjs"
      categories={[
        { name: "Frontend", slug: "frontend" },
        { name: "Backend", slug: "backend" },
      ]}
      tags={[
        { name: "Next.js", slug: "nextjs" },
        { name: "Prisma", slug: "prisma" },
      ]}
    />,
  );

  expect(container.querySelector<HTMLInputElement>('input[name="category"]')?.value).toBe("frontend");
  expect(container.querySelector<HTMLInputElement>('input[name="tag"]')?.value).toBe("nextjs");

  rerender(
    <FilterBar
      search="react"
      category="backend"
      tag="prisma"
      categories={[
        { name: "Frontend", slug: "frontend" },
        { name: "Backend", slug: "backend" },
      ]}
      tags={[
        { name: "Next.js", slug: "nextjs" },
        { name: "Prisma", slug: "prisma" },
      ]}
    />,
  );

  expect(container.querySelector<HTMLInputElement>('input[name="category"]')?.value).toBe("backend");
  expect(container.querySelector<HTMLInputElement>('input[name="tag"]')?.value).toBe("prisma");

  rerender(
    <FilterBar
      search="react"
      categories={[
        { name: "Frontend", slug: "frontend" },
        { name: "Backend", slug: "backend" },
      ]}
      tags={[
        { name: "Next.js", slug: "nextjs" },
        { name: "Prisma", slug: "prisma" },
      ]}
    />,
  );

  expect(container.querySelector<HTMLInputElement>('input[name="category"]')).not.toBeInTheDocument();
  expect(container.querySelector<HTMLInputElement>('input[name="tag"]')).not.toBeInTheDocument();
});
