import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  executeRawUnsafe: vi.fn(),
  queryRawUnsafe: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $executeRawUnsafe: prismaMocks.executeRawUnsafe,
    $queryRawUnsafe: prismaMocks.queryRawUnsafe,
  },
}));

import {
  BLOG_SITE_SETTING_KEY,
  DEFAULT_BLOG_SETTINGS,
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

  test("normalizes configurable profile and about page content", () => {
    expect(
      normalizeBlogSettingsInput({
        ...DEFAULT_BLOG_SETTINGS,
        profile: {
          ...DEFAULT_BLOG_SETTINGS.profile,
          subtitle: "  Custom subtitle  ",
          githubUrl: "https://github.com/example/",
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
      }),
      about: expect.objectContaining({
        aboutTitle: "关于站点",
        aboutParagraphs: ["第一段", "第二段"],
        nowItems: ["当前事项"],
        highlights: [{ title: "亮点", description: "描述" }],
      }),
    });
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
});
