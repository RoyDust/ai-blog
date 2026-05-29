import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { AdminPagination } from "../AdminPagination";

describe("AdminPagination", () => {
  test("renders shadcn pagination links", () => {
    render(
      <AdminPagination
        getPageHref={(page) => `/admin/items?page=${page}`}
        getPageSizeHref={(pageSize) => `/admin/items?limit=${pageSize}`}
        page={2}
        pageSize={20}
        total={95}
        totalPages={5}
      />,
    );

    expect(screen.getByRole("navigation", { name: "分页" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "上一页" })).toHaveAttribute("href", "/admin/items?page=1");
    expect(screen.getByRole("link", { name: "第 3 页" })).toHaveAttribute("href", "/admin/items?page=3");
  });

  test("uses callbacks for client-side pagination and jump navigation", () => {
    const onPageChange = vi.fn();

    render(
      <AdminPagination
        onPageChange={onPageChange}
        page={1}
        pageSize={10}
        total={25}
        totalPages={3}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    fireEvent.change(screen.getByLabelText("跳转页码"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "跳转" }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 2);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });
});
