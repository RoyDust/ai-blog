import { beforeEach, describe, expect, test, vi } from "vitest";
import { UnauthorizedError, ValidationError } from "@/lib/api-errors";

const requireAdminSession = vi.fn();
const getBlogSettings = vi.fn();
const updateBlogSettings = vi.fn();
const revalidateBlogSettings = vi.fn();

const settings = {
  siteName: "Configured Blog",
  siteDescription: "Description",
  siteUrl: "https://blog.example",
  locale: "zh-CN",
  appearance: {
    backgroundImageUrl: "/images/configured-bg.webp",
  },
  profile: {
    subtitle: "Subtitle",
    tagline: "Tagline",
    bio: "Bio",
    intro: "Intro",
    githubUrl: "https://github.com/example",
    twitterUrl: "",
  },
  about: {
    aboutTitle: "About",
    aboutParagraphs: ["Paragraph"],
    nowTitle: "Now",
    nowItems: ["Item"],
    highlights: [{ title: "Highlight", description: "Highlight description" }],
    stackTitle: "Stack",
    stack: [{ title: "Tech", description: "Tech description" }],
    contactTitle: "Contact",
    contactDescription: "Contact description",
  },
  reading: {
    monthlyGoal: 18,
  },
  newsletter: {
    enabled: false,
    provider: "none",
    fromEmail: "",
    replyTo: "",
  },
};

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings,
  updateBlogSettings,
}));

vi.mock("@/lib/cache", () => ({
  revalidateBlogSettings,
}));

describe("admin blog settings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("returns blog settings", async () => {
    getBlogSettings.mockResolvedValueOnce(settings);

    const { GET } = await import("../route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      success: true,
      data: settings,
    });
  });

  test("updates blog settings and revalidates affected routes", async () => {
    updateBlogSettings.mockResolvedValueOnce(settings);

    const body = {
      siteName: "Configured Blog",
      siteDescription: "Description",
      siteUrl: "https://blog.example/",
      locale: "zh-CN",
    };
    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/settings/blog", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateBlogSettings).toHaveBeenCalledWith(body);
    expect(revalidateBlogSettings).toHaveBeenCalledOnce();
    expect(payload.data.siteUrl).toBe("https://blog.example");
  });

  test("requires an admin session", async () => {
    requireAdminSession.mockRejectedValueOnce(new UnauthorizedError());

    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/settings/blog", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(401);
    expect(updateBlogSettings).not.toHaveBeenCalled();
  });

  test("returns validation errors from the settings layer", async () => {
    updateBlogSettings.mockRejectedValueOnce(new ValidationError("博客名称不能为空"));

    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/settings/blog", {
        method: "PATCH",
        body: JSON.stringify({ siteName: "" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("博客名称不能为空");
    expect(revalidateBlogSettings).not.toHaveBeenCalled();
  });
});
