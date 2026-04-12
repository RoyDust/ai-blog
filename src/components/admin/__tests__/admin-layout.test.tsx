import { render, screen } from "@testing-library/react";
import { within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/taxonomy",
}));

describe("admin layout", () => {
  test("renders grouped editorial navigation and workspace framing", async () => {
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    const { container } = render(
      <AdminLayout userLabel="Admin">
        <div>Taxonomy content</div>
      </AdminLayout>,
    );

    const nav = screen.getByRole("navigation", { name: "Admin navigation" });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByText("工作台")).toBeInTheDocument();
    expect(within(nav).getByText("内容")).toBeInTheDocument();
    expect(within(nav).getByText("结构")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "分类与标签" })).toHaveAttribute("href", "/admin/taxonomy");
    expect(screen.getByText("Taxonomy content")).toBeInTheDocument();

    expect(container.firstElementChild).toHaveClass("admin-theme");
    expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "280");
    expect(screen.getByTestId("admin-layout-main")).toHaveAttribute("data-content-max-width", "1600");
  });
});
