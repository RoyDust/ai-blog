import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectError = new Error("NEXT_REDIRECT");
const redirect = vi.fn((target: string) => {
  void target;
  throw redirectError;
});

vi.mock("next/navigation", () => ({ redirect }));

function parseRedirectTarget(target: string) {
  const [pathname, query = ""] = target.split("?");
  return { pathname, params: new URLSearchParams(query) };
}

describe("admin taxonomy legacy redirects", () => {
  beforeEach(() => {
    redirect.mockReset();
  });

  test("awaits Next.js 16 Promise searchParams for /admin/categories and redirects to /admin/taxonomy?q=ai&page=2&tab=categories", async () => {
    const { default: AdminCategoriesRedirectPage } = await import("../categories/page");

    await expect(
      AdminCategoriesRedirectPage({
        searchParams: Promise.resolve({ q: "ai", page: "2" }),
      }),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/admin/taxonomy?q=ai&page=2&tab=categories");
  });

  test("awaits Next.js 16 Promise searchParams for /admin/tags and redirects to /admin/taxonomy?q=llm&tab=tags", async () => {
    const { default: AdminTagsRedirectPage } = await import("../tags/page");

    await expect(
      AdminTagsRedirectPage({
        searchParams: Promise.resolve({ q: "llm" }),
      }),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/admin/taxonomy?q=llm&tab=tags");
  });

  test("preserves multi-value array params and overrides stale tab parameter", async () => {
    const { default: AdminCategoriesRedirectPage } = await import("../categories/page");

    await expect(
      AdminCategoriesRedirectPage({
        searchParams: Promise.resolve({
          q: "react",
          page: "2",
          filter: ["draft", "featured"],
          tab: "tags",
        }),
      }),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledTimes(1);
    const { pathname, params } = parseRedirectTarget(String(redirect.mock.calls[0]?.[0]));
    expect(pathname).toBe("/admin/taxonomy");
    expect(params.get("q")).toBe("react");
    expect(params.get("page")).toBe("2");
    expect(params.getAll("filter")).toEqual(["draft", "featured"]);
    expect(params.get("tab")).toBe("categories");
  });

  test("remains compatible with synchronous searchParams and omitted searchParams", async () => {
    const { default: AdminTagsRedirectPage } = await import("../tags/page");

    await expect(
      AdminTagsRedirectPage({
        searchParams: { q: "nextjs", sort: "latest" },
      }),
    ).rejects.toThrow(redirectError);

    const firstCall = parseRedirectTarget(String(redirect.mock.calls[0]?.[0]));
    expect(firstCall.pathname).toBe("/admin/taxonomy");
    expect(firstCall.params.get("q")).toBe("nextjs");
    expect(firstCall.params.get("sort")).toBe("latest");
    expect(firstCall.params.get("tab")).toBe("tags");

    redirect.mockReset();

    await expect(AdminTagsRedirectPage()).rejects.toThrow(redirectError);
    expect(redirect).toHaveBeenCalledWith("/admin/taxonomy?tab=tags");
  });
});
