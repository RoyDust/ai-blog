import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
});

const postFindMany = vi.fn();
const categoryFindMany = vi.fn();
const tagFindMany = vi.fn();
const seriesFindMany = vi.fn();
const seriesFindFirst = vi.fn();

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: { findMany: postFindMany },
    category: { findMany: categoryFindMany },
    tag: { findMany: tagFindMany },
    series: { findMany: seriesFindMany, findFirst: seriesFindFirst },
  },
}));

describe("public read API cached readers", () => {
  const store = new Map<string, { value: unknown; tags?: string[] }>();
  const setSpy = vi.fn(async (key: string, value: unknown, ctx?: { tags?: string[] }) => {
    store.set(key, { value, tags: ctx?.tags });
  });
  const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown };
  const previousCache = globalWithCache.__incrementalCache;

  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async (key: string) => {
        const hit = store.get(key);
        return hit ? { isStale: false, value: hit.value } : null;
      },
      set: setSpy,
    };
  });

  afterEach(() => {
    if (previousCache === undefined) {
      delete globalWithCache.__incrementalCache;
    } else {
      globalWithCache.__incrementalCache = previousCache;
    }
  });

  test("caches /api/posts/popular, /api/categories, /api/tags, /api/series, and /api/series/[slug] with semantic invalidation tags", async () => {
    postFindMany.mockResolvedValueOnce([{ id: "p1", title: "Top Post", slug: "top-post", viewCount: 42 }]);
    categoryFindMany.mockResolvedValueOnce([{ id: "c1", name: "AI", slug: "ai", _count: { posts: 5 } }]);
    tagFindMany.mockResolvedValueOnce([{ id: "t1", name: "Next.js", slug: "nextjs", _count: { posts: 3 } }]);
    seriesFindMany.mockResolvedValueOnce([{ id: "s1", title: "Daily", slug: "ai-daily", _count: { posts: 2 } }]);
    seriesFindFirst.mockResolvedValueOnce({
      id: "s1",
      title: "Daily",
      slug: "ai-daily",
      description: "Daily notes",
      coverImage: null,
      posts: [],
      _count: { posts: 0 },
    });

    const [{ GET: getPopular }, { GET: getCategories }, { GET: getTags }, { GET: getSeriesList }, { GET: getSeriesDetail }] =
      await Promise.all([
        import("@/app/api/posts/popular/route"),
        import("@/app/api/categories/route"),
        import("@/app/api/tags/route"),
        import("@/app/api/series/route"),
        import("@/app/api/series/[slug]/route"),
      ]);

    await getPopular(new Request("http://localhost/api/posts/popular"));
    const popularHit = await getPopular(new Request("http://localhost/api/posts/popular"));
    expect(postFindMany).toHaveBeenCalledTimes(1);
    expect((await popularHit.json()).data).toHaveLength(1);

    await getCategories(new Request("http://localhost/api/categories"));
    await getCategories(new Request("http://localhost/api/categories"));
    expect(categoryFindMany).toHaveBeenCalledTimes(1);

    await getTags(new Request("http://localhost/api/tags"));
    await getTags(new Request("http://localhost/api/tags"));
    expect(tagFindMany).toHaveBeenCalledTimes(1);

    await getSeriesList(new Request("http://localhost/api/series"));
    await getSeriesList(new Request("http://localhost/api/series"));
    expect(seriesFindMany).toHaveBeenCalledTimes(1);

    await getSeriesDetail(new Request("http://localhost/api/series/ai-daily"), {
      params: Promise.resolve({ slug: "ai-daily" }),
    });
    const detailHit = await getSeriesDetail(new Request("http://localhost/api/series/ai-daily"), {
      params: Promise.resolve({ slug: "ai-daily" }),
    });
    expect(seriesFindFirst).toHaveBeenCalledTimes(1);
    expect((await detailHit.json()).data.slug).toBe("ai-daily");

    expect(setSpy.mock.calls.map((call) => call[2]?.tags)).toEqual([
      ["public-posts"],
      ["public-categories", "public-posts"],
      ["public-tags", "public-posts"],
      ["public-posts"],
      ["public-posts", "public-categories", "public-tags"],
    ]);
  });
});
