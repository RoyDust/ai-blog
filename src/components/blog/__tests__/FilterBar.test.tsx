import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vitest";
import { FilterBar } from "../FilterBar";

test("filter bar renders inline reset entry without bottom chip row when filters are present", () => {
  const { container } = render(
    <FilterBar
      search="react"
      category="frontend"
      tag="nextjs"
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  expect(screen.getByRole("link", { name: "清空筛选" })).toHaveAttribute("href", "/posts");
  expect(container.querySelector(".ui-chip")).not.toBeInTheDocument();
  expect(container.querySelector("form")).not.toHaveClass("sticky");
  expect(container.querySelector("form")).not.toHaveClass("z-30");
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

test("selecting a draft option before submitting does not expand active chip row and inline reset clears selection", async () => {
  const { container } = render(
    <FilterBar
      categories={[{ name: "产品与体验", slug: "product-experience" }]}
      tags={[{ name: "架构演进与工程实践", slug: "architecture" }]}
    />,
  );

  fireEvent.click(screen.getByLabelText("分类筛选"));
  const option = await screen.findByRole("option", { name: "产品与体验" });
  fireEvent.mouseMove(option, { clientX: 10, clientY: 10 });
  await waitFor(() => {
    expect(option).toHaveAttribute("data-highlighted");
  });
  fireEvent.click(option);

  expect(container.querySelector<HTMLInputElement>('input[name="category"]')?.value).toBe("product-experience");
  // 未点「应用筛选」前不提前渲染底部已生效筛选条，避免卡片跳高变形与无效「清空筛选」链接
  expect(screen.queryByRole("link", { name: "清空筛选" })).not.toBeInTheDocument();

  // 点击顶栏同行的「清空筛选」按钮立即恢复初始下拉状态
  fireEvent.click(screen.getByRole("button", { name: "清空筛选" }));
  expect(container.querySelector<HTMLInputElement>('input[name="category"]')).not.toBeInTheDocument();
  expect(screen.getByLabelText("分类筛选")).toHaveTextContent("全部分类");
});

test("clicking 清空筛选 resets local select state immediately in addition to navigating to /posts", async () => {
  const { container } = render(
    <FilterBar
      category="frontend"
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  fireEvent.click(screen.getByLabelText("标签筛选"));
  const tagOption = await screen.findByRole("option", { name: "Next.js" });
  fireEvent.mouseMove(tagOption, { clientX: 10, clientY: 10 });
  await waitFor(() => {
    expect(tagOption).toHaveAttribute("data-highlighted");
  });
  fireEvent.click(tagOption);

  expect(container.querySelector<HTMLInputElement>('input[name="tag"]')?.value).toBe("nextjs");

  const clearLink = screen.getByRole("link", { name: "清空筛选" });
  clearLink.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(clearLink);

  expect(container.querySelector<HTMLInputElement>('input[name="category"]')).not.toBeInTheDocument();
  expect(container.querySelector<HTMLInputElement>('input[name="tag"]')).not.toBeInTheDocument();
});
