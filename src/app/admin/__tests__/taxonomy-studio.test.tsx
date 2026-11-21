import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache } from "swr";

const replace = vi.fn();
const toastError = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/admin/taxonomy",
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: vi.fn(),
  },
}));

async function renderTaxonomyStudio() {
  const [{ TaxonomyStudio }, { SWRConfig }] = await Promise.all([
    import("@/components/admin/taxonomy/TaxonomyStudio"),
    import("swr"),
  ]);

  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <TaxonomyStudio />
    </SWRConfig>,
  );
}

describe("TaxonomyStudio", () => {
  beforeEach(async () => {
    replace.mockReset();
    toastError.mockReset();
    search = "";
    vi.unstubAllGlobals();
    vi.resetModules();
    await clearSwrCache(() => true, undefined, { revalidate: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("defaults to categories tab and loads categories", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }),
    );

    await renderTaxonomyStudio();

    expect(screen.getByRole("heading", { name: "分类与标签" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "分类" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "标签" })).toHaveAttribute("aria-pressed", "false");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/categories?page=1&limit=10");
    });
  });

  test("respects tab=tags and loads tags", async () => {
    search = "tab=tags";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }),
    );

    await renderTaxonomyStudio();

    expect(screen.getByRole("button", { name: "标签" })).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/admin/tags?page=1&limit=10");
    });
  });

  test("switches tab by updating query params via router.replace", async () => {
    search = "q=react&page=2";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      }),
    );

    await renderTaxonomyStudio();

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
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
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
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: "cat-1",
            name: "AI",
            slug: "ai",
            description: "AI notes",
            createdAt: "2026-05-09T00:00:00.000Z",
            _count: { posts: 0 },
          }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await renderTaxonomyStudio();

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

  test("shows Chinese field errors and does not submit an invalid category", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderTaxonomyStudio();

    fireEvent.click(await screen.findByRole("button", { name: "新增分类" }));

    expect(await screen.findByText("分类名称不能为空")).toBeInTheDocument();
    expect(screen.getByText("Slug 不能为空")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("keeps the category form dirty and shows request error when creation fails", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ success: false, error: "Slug 已存在" }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await renderTaxonomyStudio();

    await screen.findByRole("button", { name: "新增分类" });
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "AI" } });
    fireEvent.change(screen.getByLabelText("说明"), { target: { value: "AI notes" } });
    fireEvent.click(screen.getByRole("button", { name: "新增分类" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Slug 已存在");
    });

    expect(screen.getByLabelText("名称")).toHaveValue("AI");
    expect(screen.getByLabelText("Slug")).toHaveValue("ai");
    expect(screen.getByLabelText("说明")).toHaveValue("AI notes");
  });

  test("disables submit while the category mutation is submitting", async () => {
    let resolveCreate: (value: Response) => void = () => {};
    const createPromise = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } }),
      })
      .mockImplementationOnce(() => createPromise)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: "cat-1",
            name: "AI",
            slug: "ai",
            description: "AI notes",
            createdAt: "2026-05-09T00:00:00.000Z",
            _count: { posts: 0 },
          }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await renderTaxonomyStudio();

    await screen.findByRole("button", { name: "新增分类" });
    fireEvent.change(screen.getByLabelText("名称"), { target: { value: "AI" } });
    fireEvent.change(screen.getByLabelText("说明"), { target: { value: "AI notes" } });
    fireEvent.click(screen.getByRole("button", { name: "新增分类" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "新增分类" })).toBeDisabled();
    });

    resolveCreate({
      ok: true,
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
    } as Response);

    expect(await screen.findByText("AI")).toBeInTheDocument();
  });

  test("updates an existing tag through the admin taxonomy form", async () => {
    search = "tab=tags";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
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
        ok: true,
        json: async () => ({ success: true, data: { id: "tag-1" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [{
            id: "tag-1",
            name: "React 19",
            slug: "react-19",
            color: "#2563eb",
            createdAt: "2026-05-09T00:00:00.000Z",
            _count: { posts: 2 },
          }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    await renderTaxonomyStudio();

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
