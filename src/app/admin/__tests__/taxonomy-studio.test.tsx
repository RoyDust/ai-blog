import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const replace = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/taxonomy",
  useSearchParams: () => new URLSearchParams(search),
}));

describe("TaxonomyStudio", () => {
  beforeEach(() => {
    replace.mockReset();
    search = "";
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults to categories tab and loads categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [] }),
      }),
    );

    const { TaxonomyStudio } = await import("@/components/admin/taxonomy/TaxonomyStudio");

    render(<TaxonomyStudio />);

    expect(screen.getByRole("heading", { name: "分类与标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分类" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "标签" })).toHaveAttribute("aria-pressed", "false");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/categories");
    });
  });

  test("respects tab=tags and loads tags", async () => {
    search = "tab=tags";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [] }),
      }),
    );

    const { TaxonomyStudio } = await import("@/components/admin/taxonomy/TaxonomyStudio");

    render(<TaxonomyStudio />);

    expect(screen.getByRole("button", { name: "标签" })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/tags");
    });
  });

  test("switches tab by updating query params via router.replace", async () => {
    search = "q=react&page=2";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ success: true, data: [] }),
      }),
    );

    const { TaxonomyStudio } = await import("@/components/admin/taxonomy/TaxonomyStudio");

    render(<TaxonomyStudio />);

    fireEvent.click(screen.getByRole("button", { name: "标签" }));

    expect(replace).toHaveBeenCalledTimes(1);
    const target = String(replace.mock.calls[0]?.[0]);
    const [pathname, query = ""] = target.split("?");
    const params = new URLSearchParams(query);

    expect(pathname).toBe("/admin/taxonomy");
    expect(params.get("q")).toBe("react");
    expect(params.get("page")).toBe("2");
    expect(params.get("tab")).toBe("tags");
  });

  test("creates a category through the admin taxonomy form", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            id: "cat-1",
            name: "AI",
            slug: "ai",
            description: "AI notes",
            createdAt: "2026-05-09T00:00:00.000Z",
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { TaxonomyStudio } = await import("@/components/admin/taxonomy/TaxonomyStudio");

    render(<TaxonomyStudio />);

    await screen.findByRole("button", { name: "新增分类" });
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "AI" } });
    fireEvent.change(screen.getByLabelText("说明"), { target: { value: "AI notes" } });
    fireEvent.click(screen.getByRole("button", { name: "新增分类" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/categories",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "AI", slug: "ai", description: "AI notes" }),
        }),
      );
    });

    expect(await screen.findByText("AI")).toBeInTheDocument();
  });

  test("updates an existing tag through the admin taxonomy form", async () => {
    search = "tab=tags";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{
            id: "tag-1",
            name: "React",
            slug: "react",
            color: "#2563eb",
            createdAt: "2026-05-09T00:00:00.000Z",
            _count: { posts: 2 },
          }],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true, data: { id: "tag-1" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { TaxonomyStudio } = await import("@/components/admin/taxonomy/TaxonomyStudio");

    render(<TaxonomyStudio />);

    fireEvent.click(await screen.findByRole("button", { name: "编辑" }));
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "React 19" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "react-19" } });
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/tags",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ id: "tag-1", name: "React 19", slug: "react-19", color: "#2563eb" }),
        }),
      );
    });

    expect(await screen.findByText("React 19")).toBeInTheDocument();
  });
});
