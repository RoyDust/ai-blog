import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";

test("sidebar loads categories from the public api route", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/categories")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: [{ id: "c1", name: "前端", slug: "frontend", _count: { posts: 3 } }] }),
          { status: 200 }
        )
      );
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const { getByRole, getByText, container } = render(<Sidebar />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
  });

  expect(getByText("前端")).toBeInTheDocument();
  expect(container.querySelector(".reader-panel")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="sidebar-taxonomy-rail"]')?.className).toContain("sticky");
  expect(getByRole("heading", { name: "My Blog" })).toBeInTheDocument();
  expect(getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
  expect(getByRole("heading", { name: "本月阅读目标" })).toBeInTheDocument();

  fetchMock.mockRestore();
});
