import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const userFindFirstMock = vi.fn();
const getBlogSettingsMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: userFindFirstMock,
    },
  },
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: getBlogSettingsMock,
}));

const originalContactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const baseSettings = {
  siteName: "Inkforge",
  siteDescription: "Description",
  siteUrl: "https://roydust.top",
  locale: "zh-CN",
  profile: {
    subtitle: "专注前端开发与工程实践",
    tagline: "内容创作 / 前端体验 / 开源实践",
    bio: "作者简介",
    intro: "作者介绍",
    githubUrl: "https://github.com/RoyDust",
    twitterUrl: "",
  },
};

describe("getPublicProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    getBlogSettingsMock.mockResolvedValue(baseSettings);
  });

  afterEach(() => {
    if (originalContactEmail === undefined) {
      delete process.env.NEXT_PUBLIC_CONTACT_EMAIL;
    } else {
      process.env.NEXT_PUBLIC_CONTACT_EMAIL = originalContactEmail;
    }
  });

  test("never selects or exposes admin User.email when NEXT_PUBLIC_CONTACT_EMAIL is empty", async () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "";
    userFindFirstMock.mockResolvedValueOnce({
      name: "RoyDust",
      email: "codex-browser-admin-secret@local.test",
      image: "https://example.com/avatar.png",
    });

    const { getPublicProfile } = await import("../public-profile");
    const profile = await getPublicProfile();

    expect(userFindFirstMock).toHaveBeenCalledWith({
      where: { role: "ADMIN" },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
      select: {
        name: true,
        image: true,
      },
    });
    expect(profile.email).toBe("");
    expect(profile.links).toEqual([{ kind: "github", name: "GitHub", url: "https://github.com/RoyDust" }]);
    expect(JSON.stringify(profile)).not.toContain("codex-browser-admin-secret@local.test");
  });

  test("returns NEXT_PUBLIC_CONTACT_EMAIL and mailto link when configured", async () => {
    process.env.NEXT_PUBLIC_CONTACT_EMAIL = "contact@roydust.top";
    userFindFirstMock.mockResolvedValueOnce({
      name: "RoyDust",
      image: "https://example.com/avatar.png",
    });

    const { getPublicProfile } = await import("../public-profile");
    const profile = await getPublicProfile();

    expect(profile.email).toBe("contact@roydust.top");
    expect(profile.links).toEqual([
      { kind: "github", name: "GitHub", url: "https://github.com/RoyDust" },
      { kind: "email", name: "Email", url: "mailto:contact@roydust.top" },
    ]);
  });

  test("deduplicates repeated calls within a single React.cache request scope", async () => {
    vi.resetModules();
    vi.doMock("react", async (importOriginal) => {
      const actual = await importOriginal<typeof import("react")>();
      return {
        ...actual,
        cache: <T extends (...args: never[]) => unknown>(fn: T) => {
          let cached: { initialized: boolean; value: unknown } = { initialized: false, value: undefined };
          return ((...args: Parameters<T>) => {
            if (!cached.initialized) {
              cached = { initialized: true, value: fn(...args) };
            }
            return cached.value;
          }) as T;
        },
      };
    });

    try {
      userFindFirstMock.mockResolvedValueOnce({
        name: "RoyDust",
        image: "https://example.com/avatar.png",
      });

      const { getPublicProfile } = await import("../public-profile");
      const [first, second] = await Promise.all([getPublicProfile(), getPublicProfile()]);

      expect(first).toEqual(second);
      expect(getBlogSettingsMock).toHaveBeenCalledTimes(1);
      expect(userFindFirstMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock("react");
      vi.resetModules();
    }
  });
});
