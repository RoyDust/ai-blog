import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
  return {
    executeRawUnsafe: vi.fn(),
    queryRawUnsafe: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: prismaMocks.executeRawUnsafe,
    $queryRawUnsafe: prismaMocks.queryRawUnsafe,
  },
}));

import {
  BLOG_SITE_SETTING_KEY,
  DEFAULT_BLOG_SETTINGS,
  DEFAULT_READER_BACKGROUND_IMAGE_URL,
  getBlogSettings,
  normalizeBlogSettingsInput,
  updateBlogSettings,
} from "@/lib/blog-settings";
import { prisma } from "@/lib/prisma";

describe("blog settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = "https://configured.example/";
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3000";
  });

  test("returns defaults with environment-aware site url when no setting exists", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([]);

    await expect(getBlogSettings()).resolves.toEqual({
      ...DEFAULT_BLOG_SETTINGS,
      siteUrl: "https://configured.example",
    });
  });

  test("normalizes stored blog settings", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([{
      value: {
        siteName: "  Configured Blog  ",
        siteDescription: "A configured site.",
        siteUrl: "https://blog.example/",
        locale: "en-US",
      },
    }]);

    await expect(getBlogSettings()).resolves.toEqual({
      siteName: "Configured Blog",
      siteDescription: "A configured site.",
      siteUrl: "https://blog.example",
      locale: "en-US",
      appearance: DEFAULT_BLOG_SETTINGS.appearance,
      profile: DEFAULT_BLOG_SETTINGS.profile,
      about: DEFAULT_BLOG_SETTINGS.about,
      reading: DEFAULT_BLOG_SETTINGS.reading,
      newsletter: DEFAULT_BLOG_SETTINGS.newsletter,
    });
  });

  test("falls back to defaults when the settings table cannot be read", async () => {
    prismaMocks.queryRawUnsafe.mockRejectedValueOnce(Object.assign(new Error('relation "system_settings" does not exist'), { code: "42P01" }));

    await expect(getBlogSettings()).resolves.toMatchObject({
      siteName: DEFAULT_BLOG_SETTINGS.siteName,
      siteUrl: "https://configured.example",
    });
  });

  test("falls back to defaults when raw reads are unavailable", async () => {
    const client = prisma as unknown as { $queryRawUnsafe?: typeof prismaMocks.queryRawUnsafe };
    const originalQueryRawUnsafe = client.$queryRawUnsafe;
    client.$queryRawUnsafe = undefined;

    try {
      await expect(getBlogSettings()).resolves.toMatchObject({
        siteName: DEFAULT_BLOG_SETTINGS.siteName,
        siteUrl: "https://configured.example",
      });
      expect(prismaMocks.queryRawUnsafe).not.toHaveBeenCalled();
    } finally {
      client.$queryRawUnsafe = originalQueryRawUnsafe;
    }
  });

  test("validates editable fields", () => {
    expect(() =>
      normalizeBlogSettingsInput({
        siteName: "",
        siteDescription: "Description",
        siteUrl: "https://blog.example",
        locale: "zh-CN",
      }),
    ).toThrow("博客名称不能为空");

    expect(() =>
      normalizeBlogSettingsInput({
        siteName: "Configured Blog",
        siteDescription: "Description",
        siteUrl: "ftp://blog.example",
        locale: "zh-CN",
      }),
    ).toThrow("站点地址必须使用 http 或 https");

    expect(() =>
      normalizeBlogSettingsInput({
        siteName: "Configured Blog",
        siteDescription: "Description",
        siteUrl: "https://blog.example",
        locale: "zh_CN",
      }),
    ).toThrow("默认语言必须是有效语言标签");
  });

  test("persists settings under the blog site key", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([]);
    prismaMocks.executeRawUnsafe.mockResolvedValueOnce(1);

    await expect(
      updateBlogSettings({
        siteName: "Configured Blog",
        siteDescription: "Description",
        siteUrl: "https://blog.example/",
        locale: "zh-CN",
      }),
    ).resolves.toMatchObject({
      siteName: "Configured Blog",
      siteDescription: "Description",
      siteUrl: "https://blog.example",
      locale: "zh-CN",
    });

    expect(prismaMocks.executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "system_settings"'),
      BLOG_SITE_SETTING_KEY,
      expect.any(String),
    );
    expect(JSON.parse(prismaMocks.executeRawUnsafe.mock.calls[0][2])).toMatchObject({
      siteName: "Configured Blog",
      siteDescription: "Description",
      siteUrl: "https://blog.example",
      locale: "zh-CN",
      appearance: DEFAULT_BLOG_SETTINGS.appearance,
      profile: DEFAULT_BLOG_SETTINGS.profile,
      about: DEFAULT_BLOG_SETTINGS.about,
      reading: DEFAULT_BLOG_SETTINGS.reading,
      newsletter: DEFAULT_BLOG_SETTINGS.newsletter,
    });
  });

  test("fails instead of reporting success when raw writes are unavailable", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([]);
    const client = prisma as unknown as { $executeRawUnsafe?: typeof prismaMocks.executeRawUnsafe };
    const originalExecuteRawUnsafe = client.$executeRawUnsafe;
    client.$executeRawUnsafe = undefined;

    try {
      await expect(
        updateBlogSettings({
          siteName: "Configured Blog",
          siteDescription: "Description",
          siteUrl: "https://blog.example/",
          locale: "zh-CN",
        }),
      ).rejects.toThrow("博客配置持久化不可用，请检查数据库客户端配置");
    } finally {
      client.$executeRawUnsafe = originalExecuteRawUnsafe;
    }
  });

  test("merges partial settings updates with the current stored settings", async () => {
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([{
      value: {
        ...DEFAULT_BLOG_SETTINGS,
        siteName: "Existing Blog",
        siteDescription: "Existing description",
        siteUrl: "https://existing.example",
        profile: {
          ...DEFAULT_BLOG_SETTINGS.profile,
          subtitle: "Existing subtitle",
          githubUrl: "https://github.com/existing",
        },
      },
    }]);
    prismaMocks.executeRawUnsafe.mockResolvedValueOnce(1);

    await expect(
      updateBlogSettings({
        profile: {
          tagline: "  New tagline  ",
          twitterUrl: "https://x.com/new/",
        },
      }),
    ).resolves.toMatchObject({
      siteName: "Existing Blog",
      siteDescription: "Existing description",
      siteUrl: "https://existing.example",
      appearance: DEFAULT_BLOG_SETTINGS.appearance,
      profile: expect.objectContaining({
        subtitle: "Existing subtitle",
        tagline: "New tagline",
        githubUrl: "https://github.com/existing",
        twitterUrl: "https://x.com/new",
      }),
    });

    expect(JSON.parse(prismaMocks.executeRawUnsafe.mock.calls[0][2])).toMatchObject({
      siteName: "Existing Blog",
      siteDescription: "Existing description",
      siteUrl: "https://existing.example",
      appearance: DEFAULT_BLOG_SETTINGS.appearance,
      profile: expect.objectContaining({
        subtitle: "Existing subtitle",
        tagline: "New tagline",
        githubUrl: "https://github.com/existing",
        twitterUrl: "https://x.com/new",
      }),
      about: DEFAULT_BLOG_SETTINGS.about,
      reading: DEFAULT_BLOG_SETTINGS.reading,
      newsletter: DEFAULT_BLOG_SETTINGS.newsletter,
    });
  });

  test("normalizes configurable profile and about page content including public contact email round-trip", () => {
    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        profile: {
          ...DEFAULT_BLOG_SETTINGS.profile,
          subtitle: "  Custom subtitle  ",
          githubUrl: "https://github.com/example/",
          email: "  Public@RoyDust.top ",
        },
        about: {
          ...DEFAULT_BLOG_SETTINGS.about,
          aboutTitle: "关于站点",
          aboutParagraphs: [" 第一段 ", "第二段"],
          nowItems: ["当前事项"],
          highlights: [{ title: "亮点", description: "描述" }],
        },
      }),
    ).toMatchObject({
      profile: expect.objectContaining({
        subtitle: "Custom subtitle",
        githubUrl: "https://github.com/example",
        email: "public@roydust.top",
      }),
      about: expect.objectContaining({
        aboutTitle: "关于站点",
        aboutParagraphs: ["第一段", "第二段"],
        nowItems: ["当前事项"],
        highlights: [{ title: "亮点", description: "描述" }],
      }),
    });

    expect(() =>
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        profile: {
          ...DEFAULT_BLOG_SETTINGS.profile,
          email: "not-an-email",
        },
      }),
    ).toThrow("公开联系邮箱必须是有效邮箱");
  });

  test("preserves stored profile.email on getBlogSettings and partial updateBlogSettings round-trips", async () => {
    const storedRow = {
      value: {
        ...DEFAULT_BLOG_SETTINGS,
        siteName: "Inkforge",
        siteUrl: "https://roydust.top",
        profile: {
          ...DEFAULT_BLOG_SETTINGS.profile,
          email: " Public-Contact@RoyDust.top ",
        },
      },
    };
    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([storedRow]);

    await expect(getBlogSettings()).resolves.toMatchObject({
      siteName: "Inkforge",
      profile: expect.objectContaining({
        email: "public-contact@roydust.top",
      }),
    });

    prismaMocks.queryRawUnsafe.mockResolvedValueOnce([storedRow]);
    prismaMocks.executeRawUnsafe.mockResolvedValueOnce(1);

    const updated = await updateBlogSettings({
      profile: {
        tagline: "Updated tagline",
      },
    });

    expect(updated.profile.email).toBe("public-contact@roydust.top");
    expect(JSON.parse(prismaMocks.executeRawUnsafe.mock.calls[0][2])).toMatchObject({
      siteName: "Inkforge",
      profile: expect.objectContaining({
        tagline: "Updated tagline",
        email: "public-contact@roydust.top",
      }),
    });
  });

  test("updateBlogSettings locks row in $transaction without reading stale unstable_cache and fails closed on DB read errors", async () => {
    const txQueryRawUnsafe = vi.fn().mockResolvedValueOnce([
      {
        value: {
          ...DEFAULT_BLOG_SETTINGS,
          siteName: "Fresh Uncached DB Site",
          siteUrl: "https://fresh.example",
          profile: {
            ...DEFAULT_BLOG_SETTINGS.profile,
            email: "fresh@example.com",
          },
        },
      },
    ]);
    const txExecuteRawUnsafe = vi.fn().mockResolvedValueOnce(1);
    const transactionMock = vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: txQueryRawUnsafe,
        $executeRawUnsafe: txExecuteRawUnsafe,
      }),
    );

    const store = new Map<string, { value: unknown }>();
    const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown };
    const previousCache = globalWithCache.__incrementalCache;
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async () => ({
        isStale: false,
        value: {
          ...DEFAULT_BLOG_SETTINGS,
          siteName: "Stale Cached Site",
          siteUrl: "https://stale.example",
        },
      }),
      set: async (key: string, value: unknown) => {
        store.set(key, { value });
      },
    };

    const client = prisma as unknown as {
      $transaction?: typeof transactionMock;
    };
    client.$transaction = transactionMock;

    try {
      const updated = await updateBlogSettings({
        reading: { monthlyGoal: 42 },
      });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(txQueryRawUnsafe).toHaveBeenCalledWith(
        'SELECT "value" FROM "system_settings" WHERE "key" = $1 FOR UPDATE',
        BLOG_SITE_SETTING_KEY,
      );
      expect(prismaMocks.queryRawUnsafe).not.toHaveBeenCalled();
      expect(updated.siteName).toBe("Fresh Uncached DB Site");
      expect(updated.profile.email).toBe("fresh@example.com");
      expect(updated.reading.monthlyGoal).toBe(42);
      expect(JSON.parse(txExecuteRawUnsafe.mock.calls[0][2])).toMatchObject({
        siteName: "Fresh Uncached DB Site",
        reading: { monthlyGoal: 42 },
      });

      // Transient DB read failure must fail closed (503) instead of overwriting row with "My Blog"
      txQueryRawUnsafe.mockRejectedValueOnce(new Error("connect ECONNRESET"));
      await expect(
        updateBlogSettings({
          newsletter: { enabled: true },
        }),
      ).rejects.toMatchObject({
        status: 503,
      });
      expect(txExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    } finally {
      delete client.$transaction;
      if (previousCache === undefined) {
        delete globalWithCache.__incrementalCache;
      } else {
        globalWithCache.__incrementalCache = previousCache;
      }
    }
  });

  test("normalizes configurable appearance background image", () => {
    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        appearance: {
          backgroundImageUrl: " /images/custom-bg.webp ",
        },
      }),
    ).toMatchObject({
      appearance: {
        backgroundImageUrl: "/images/custom-bg.webp",
      },
    });

    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        appearance: {
          backgroundImageUrl: "https://cdn.example.com/background.png?size=large",
        },
      }),
    ).toMatchObject({
      appearance: {
        backgroundImageUrl: "https://cdn.example.com/background.png?size=large",
      },
    });

    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        appearance: {
          backgroundImageUrl: "",
        },
      }),
    ).toMatchObject({
      appearance: {
        backgroundImageUrl: DEFAULT_READER_BACKGROUND_IMAGE_URL,
      },
    });

    expect(() =>
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        appearance: {
          backgroundImageUrl: "javascript:alert(1)",
        },
      }),
    ).toThrow("背景图地址必须使用 http 或 https");
  });

  test("normalizes monthly reading goal settings", () => {
    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        reading: {
          monthlyGoal: 12.8,
        },
      }),
    ).toMatchObject({
      reading: {
        monthlyGoal: 12,
      },
    });

    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        reading: {
          monthlyGoal: -10,
        },
      }),
    ).toMatchObject({
      reading: {
        monthlyGoal: 1,
      },
    });
  });

  test("normalizes newsletter settings", () => {
    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        newsletter: {
          enabled: true,
          provider: "log",
          fromEmail: " News@Example.com ",
          replyTo: " Replies@Example.com ",
        },
      }),
    ).toMatchObject({
      newsletter: {
        enabled: true,
        provider: "log",
        fromEmail: "news@example.com",
        replyTo: "replies@example.com",
      },
    });

    expect(() =>
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        newsletter: {
          fromEmail: "invalid",
        },
      }),
    ).toThrow("发件邮箱必须是有效邮箱");
  });

  test("does not cache fallback settings during DB-less build errors and caches real DB settings for 300s once reachable", async () => {
    const store = new Map<string, { value: unknown; revalidate?: number; tags?: string[] }>();
    const setSpy = vi.fn(async (key: string, value: unknown, ctx?: { tags?: string[] }) => {
      store.set(key, { value, tags: ctx?.tags });
    });
    const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown };
    const previousCache = globalWithCache.__incrementalCache;
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async (key: string) => {
        const hit = store.get(key);
        return hit ? { isStale: false, value: hit.value } : null;
      },
      set: setSpy,
    };

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      // 1) Simulate DB-less build failure: fallback "My Blog" must NOT be written into incrementalCache
      prismaMocks.queryRawUnsafe.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:1"));
      await expect(getBlogSettings()).resolves.toMatchObject({
        siteName: "My Blog",
      });
      expect(setSpy).not.toHaveBeenCalled();

      // 2) First runtime visitor with real DB: queries DB once, returns real siteName, and caches for 300s
      prismaMocks.queryRawUnsafe.mockResolvedValueOnce([
        {
          value: {
            siteName: "Inkforge Live",
            siteDescription: "Production description",
            siteUrl: "https://inkforge.example",
            locale: "zh-CN",
          },
        },
      ]);
      await expect(getBlogSettings()).resolves.toMatchObject({
        siteName: "Inkforge Live",
        siteUrl: "https://inkforge.example",
      });
      expect(prismaMocks.queryRawUnsafe).toHaveBeenCalledTimes(2);
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(setSpy.mock.calls[0]?.[2]).toMatchObject({
        tags: ["blog-settings"],
      });

      // 3) Second runtime visitor hits unstable_cache without hitting PostgreSQL again
      await expect(getBlogSettings()).resolves.toMatchObject({
        siteName: "Inkforge Live",
      });
      expect(prismaMocks.queryRawUnsafe).toHaveBeenCalledTimes(2);
    } finally {
      consoleError.mockRestore();
      if (previousCache === undefined) {
        delete globalWithCache.__incrementalCache;
      } else {
        globalWithCache.__incrementalCache = previousCache;
      }
    }
  });
});
