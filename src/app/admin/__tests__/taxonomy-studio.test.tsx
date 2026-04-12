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
});
