import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
  return {
    queryRawUnsafe: vi.fn(),
    userFindFirst: vi.fn(),
    postFindMany: vi.fn(),
    categoryFindMany: vi.fn(),
    tagFindMany: vi.fn(),
    seriesFindMany: vi.fn(),
    topicGuideFindMany: vi.fn(),
  };
});

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: prismaMocks.queryRawUnsafe,
    user: { findFirst: prismaMocks.userFindFirst },
    post: { findMany: prismaMocks.postFindMany },
    category: { findMany: prismaMocks.categoryFindMany },
    tag: { findMany: prismaMocks.tagFindMany },
    series: { findMany: prismaMocks.seriesFindMany },
    topicGuide: { findMany: prismaMocks.topicGuideFindMany },
  },
}));

describe("DB-less build -> DB-connected runtime first-visitor & TopicGuide sitemap contracts", () => {
  const store = new Map<string, { value: unknown; tags?: string[] }>();
  const setSpy = vi.fn(async (key: string, value: unknown, ctx?: { tags?: string[] }) => {
    store.set(key, { value, tags: ctx?.tags });
  });
  const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown };
  const previousCache = globalWithCache.__incrementalCache;

  beforeEach(() => {
    vi.clearAllMocks();
    store.clear();
    process.env.NEXT_PUBLIC_SITE_URL = "https://fallback.example";
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

  test("/about, /contact, /llms.txt, and /api/ai/openapi serve real DB siteName on first hit after DB-less build", async () => {
    const aboutModule = await import("@/app/(public)/about/page");
    const contactModule = await import("@/app/(public)/contact/page");
    const llmsModule = await import("@/app/llms.txt/route");
    const openapiModule = await import("@/app/api/ai/openapi/route");
    const { getBlogSettings } = await import("@/lib/blog-settings");

    expect(aboutModule.dynamic).toBe("force-dynamic");
    expect(contactModule.dynamic).toBe("force-dynamic");
    expect(llmsModule.dynamic).toBe("force-dynamic");
    expect(openapiModule.dynamic).toBe("force-dynamic");

    // 1) Simulate DB-less `next build`: unreachable database must NOT poison Data Cache with "My Blog"
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    prismaMocks.queryRawUnsafe.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:1"));
    const buildFallback = await getBlogSettings();
    expect(buildFallback.siteName).toBe("My Blog");
    expect(setSpy).not.toHaveBeenCalled();
    consoleError.mockRestore();

    // 2) Simulate `next start` connected to real PostgreSQL: VERY FIRST HTTP visitor gets real DB values
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([
      {
        value: {
          siteName: "Inkforge Studio",
          siteDescription: "Real DB description",
          siteUrl: "https://inkforge.studio",
          locale: "zh-CN",
          profile: {
            subtitle: "AI Engineering",
            tagline: "Real Tagline",
            bio: "Real Bio from DB",
            intro: "Real Intro from DB",
            githubUrl: "https://github.com/inkforge",
            twitterUrl: "",
          },
        },
      },
    ]);
    prismaMocks.userFindFirst.mockResolvedValue({
      name: "Roy",
      email: "roy@example.com",
      image: null,
    });

    const llmsRes = await llmsModule.GET();
    const llmsText = await llmsRes.text();
    expect(llmsText).toContain("# Inkforge Studio AI Authoring");
    expect(llmsText).toContain("https://inkforge.studio/api/ai/openapi");
    expect(llmsText).not.toContain("My Blog");

    // Subsequent calls (/api/ai/openapi, /about, /contact) hit the 300s unstable_cache without re-querying system_settings
    const openapiRes = await openapiModule.GET(new Request("https://inkforge.studio/api/ai/openapi"));
    const openapiJson = await openapiRes.json();
    expect(openapiJson.info.title).toBe("Inkforge Studio AI Authoring API");
    expect(openapiJson.servers).toEqual([{ url: "https://inkforge.studio" }]);

    const aboutMeta = await aboutModule.generateMetadata();
    const contactMeta = await contactModule.generateMetadata();
    expect(aboutMeta.description).toBe("Real Bio from DB");
    expect(aboutMeta.alternates?.canonical).toBe("https://inkforge.studio/about");
    expect(contactMeta.alternates?.canonical).toBe("https://inkforge.studio/contact");
    expect(prismaMocks.queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  test("sitemap includes /guides and published non-deleted TopicGuides", async () => {
    prismaMocks.postFindMany.mockResolvedValueOnce([]);
    prismaMocks.categoryFindMany.mockResolvedValueOnce([]);
    prismaMocks.tagFindMany.mockResolvedValueOnce([]);
    prismaMocks.seriesFindMany.mockResolvedValueOnce([]);
    prismaMocks.topicGuideFindMany.mockResolvedValueOnce([
      {
        slug: "nextjs-caching-guide",
        createdAt: new Date("2026-04-01T00:00:00Z"),
        updatedAt: new Date("2026-04-05T00:00:00Z"),
        posts: [{ post: { updatedAt: new Date("2026-04-20T00:00:00Z") } }],
      },
    ]);

    const { buildSitemap } = await import("@/app/sitemap");
    const { prisma } = await import("@/lib/prisma");
    const entries = await buildSitemap(prisma, "https://inkforge.studio");
    const urls = entries.map((entry) => entry.url);

    expect(prismaMocks.topicGuideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "published",
          deletedAt: null,
        },
      }),
    );
    expect(urls).toContain("https://inkforge.studio/guides");
    expect(urls).toContain("https://inkforge.studio/guides/nextjs-caching-guide");
    expect(entries.find((entry) => entry.url === "https://inkforge.studio/guides/nextjs-caching-guide")?.lastModified).toEqual(
      new Date("2026-04-20T00:00:00Z"),
    );
  });
});
