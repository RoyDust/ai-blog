import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { AdminBreadcrumbs } from "../AdminBreadcrumbs";

describe("AdminBreadcrumbs", () => {
  test("renders non-last crumbs as links and the last crumb as current page text", () => {
    render(
      <AdminBreadcrumbs
        items={[
          { label: "后台", href: "/admin" },
          { label: "文章", href: "/admin/posts" },
          { label: "新建文章", href: "/admin/posts/new" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "后台" })).toHaveAttribute("href", "/admin");
    expect(within(nav).getByRole("link", { name: "文章" })).toHaveAttribute("href", "/admin/posts");
    expect(within(nav).getByText("新建文章")).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "新建文章" })).not.toBeInTheDocument();
  });

  test("renders a single crumb as plain text without links", () => {
    render(<AdminBreadcrumbs items={[{ label: "后台", href: "/admin" }]} />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByText("后台")).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link")).not.toBeInTheDocument();
  });
});
