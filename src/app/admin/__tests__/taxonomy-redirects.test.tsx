import { beforeEach, describe, expect, test, vi } from "vitest";

const redirectError = new Error("NEXT_REDIRECT");
const redirect = vi.fn(() => {
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

  test("redirects /admin/categories to taxonomy with tab=categories and preserves query", async () => {
    const { default: CategoriesPage } = await import("../categories/page");

    await expect(
      CategoriesPage({
        searchParams: { q: "react", page: "2", tab: "tags" },
      } as never),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledTimes(1);
    const { pathname, params } = parseRedirectTarget(String(redirect.mock.calls[0]?.[0]));
    expect(pathname).toBe("/admin/taxonomy");
    expect(params.get("q")).toBe("react");
    expect(params.get("page")).toBe("2");
    expect(params.get("tab")).toBe("categories");
  });

  test("redirects /admin/tags to taxonomy with tab=tags and preserves query", async () => {
    const { default: TagsPage } = await import("../tags/page");

    await expect(
      TagsPage({
        searchParams: { q: "nextjs", sort: "latest" },
      } as never),
    ).rejects.toThrow(redirectError);

    expect(redirect).toHaveBeenCalledTimes(1);
    const { pathname, params } = parseRedirectTarget(String(redirect.mock.calls[0]?.[0]));
    expect(pathname).toBe("/admin/taxonomy");
    expect(params.get("q")).toBe("nextjs");
    expect(params.get("sort")).toBe("latest");
    expect(params.get("tab")).toBe("tags");
  });
});

