import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";

test("sidebar loads categories and tags from real api routes", async () => {
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
    if (url.endsWith("/api/tags")) {
      return Promise.resolve(
        new Response(JSON.stringify({ success: true, data: [{ id: "t1", name: "nextjs", slug: "nextjs" }] }), { status: 200 })
      );
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const { getByRole, getByText } = render(<Sidebar />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
  });

  expect(getByText("前端")).toBeInTheDocument();
  expect(getByText("nextjs")).toBeInTheDocument();
  expect(getByRole("link", { name: /文章归档/ })).toHaveAttribute("href", "/archives");

  fetchMock.mockRestore();
});
