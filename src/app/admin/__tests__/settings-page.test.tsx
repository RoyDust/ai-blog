import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const { getBlogSettingsMock, getServerSessionMock, userFindUniqueMock } = vi.hoisted(() => ({
  getBlogSettingsMock: vi.fn(),
  getServerSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: getBlogSettingsMock,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: userFindUniqueMock,
    },
  },
}));

vi.mock("@/lib/seo", () => ({
  getSiteUrl: () => "https://roydust.top",
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const configuredBlogSettings = {
  siteName: "Configured Blog",
  siteDescription: "Configured description",
  siteUrl: "https://blog.example",
  locale: "zh-CN",
  profile: {
    subtitle: "Configured subtitle",
    tagline: "Configured tagline",
    bio: "Configured author bio",
    intro: "Configured author intro",
    githubUrl: "https://github.com/example",
    twitterUrl: "https://x.com/example",
  },
  about: {
    aboutTitle: "Configured about",
    aboutParagraphs: ["Configured paragraph"],
    nowTitle: "Configured now",
    nowItems: ["Configured item"],
    highlights: [{ title: "Configured highlight", description: "Highlight description" }],
    stackTitle: "Configured stack",
    stack: [{ title: "Configured tech", description: "Tech description" }],
    contactTitle: "Configured contact",
    contactDescription: "Configured contact description",
  },
};

describe("admin settings page", () => {
  test("renders persisted blog settings and profile settings from the current user", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
    getBlogSettingsMock.mockResolvedValueOnce(configuredBlogSettings);
    userFindUniqueMock.mockResolvedValueOnce({
      id: "user-1",
      name: "RoyDust",
      email: "roy@example.com",
      image: "https://example.com/avatar.png",
      role: "ADMIN",
    });

    const { default: AdminSettingsPage } = await import("../settings/page");
    const ui = await AdminSettingsPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "设置" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "设置分类" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /账号资料/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "个人信息" })).toBeInTheDocument();
    expect(screen.getByLabelText("显示名称")).toHaveValue("RoyDust");
    expect(screen.getByLabelText("邮箱")).toHaveValue("roy@example.com");
    expect(screen.getByLabelText("头像 URL")).toHaveValue("https://example.com/avatar.png");
    expect(screen.getByRole("button", { name: "编辑头像" })).toBeInTheDocument();
    expect(screen.getByText("点击头像裁切并上传新图片")).toBeInTheDocument();
    expect(screen.getByText("可手动填写远程图片 URL，也可以点击头像裁切上传。留空会移除头像。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存个人信息" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /站点基础/ }));
    expect(screen.getByRole("tab", { name: /站点基础/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "博客配置" })).toBeInTheDocument();
    expect(screen.getByLabelText("博客名称")).toHaveValue("Configured Blog");
    expect(screen.getByLabelText("站点描述")).toHaveValue("Configured description");
    expect(screen.getByLabelText("站点地址")).toHaveValue("https://blog.example");
    expect(screen.getByRole("button", { name: "保存博客配置" })).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: /公开个人信息栏/ }));
    expect(screen.getByRole("tab", { name: /公开个人信息栏/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "公开个人信息栏" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "博客配置" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "关于页面内容" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("作者副标题")).toHaveValue("Configured subtitle");
    expect(screen.getByLabelText("作者标语")).toHaveValue("Configured tagline");
    expect(screen.getByLabelText("作者简介")).toHaveValue("Configured author bio");
    expect(screen.getByLabelText("作者介绍")).toHaveValue("Configured author intro");
    expect(screen.getByLabelText("GitHub 链接")).toHaveValue("https://github.com/example");
    expect(screen.getByLabelText("Twitter / X 链接")).toHaveValue("https://x.com/example");
    expect(screen.getByRole("button", { name: "保存博客配置" })).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: /关于页面/ }));
    expect(screen.getByRole("tab", { name: /关于页面/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "关于页面内容" })).toBeInTheDocument();
    expect(screen.getByLabelText("关于模块标题")).toHaveValue("Configured about");
    expect(screen.getByLabelText("关于模块段落")).toHaveValue("Configured paragraph");
    expect(screen.getByLabelText("动态模块标题")).toHaveValue("Configured now");
    expect(screen.getByLabelText("动态条目")).toHaveValue("Configured item");
    expect(screen.getByLabelText("亮点 1 标题")).toHaveValue("Configured highlight");
    expect(screen.getByLabelText("技术栈 1 标题")).toHaveValue("Configured tech");
    expect(screen.getByLabelText("联系模块标题")).toHaveValue("Configured contact");
    expect(screen.getByRole("button", { name: "保存博客配置" })).toBeEnabled();

    fireEvent.click(screen.getByRole("tab", { name: /日志策略/ }));
    expect(screen.getByRole("tab", { name: /日志策略/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "日志设置" })).toBeInTheDocument();
    expect(screen.getByLabelText("日志大小限制")).toHaveValue(10);
    expect(screen.getByText("默认 10 MB。保存后会立即按新上限裁剪旧日志，保留最新记录。")).toBeInTheDocument();
    expect(screen.getByText("当前保留 0 条接口日志。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存日志设置" })).toBeInTheDocument();
  });

  test("submits only the active blog settings section", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
    getBlogSettingsMock.mockResolvedValueOnce(configuredBlogSettings);
    userFindUniqueMock.mockResolvedValueOnce({
      id: "user-1",
      name: "RoyDust",
      email: "roy@example.com",
      image: "https://example.com/avatar.png",
      role: "ADMIN",
    });

    const fetchMock = vi.fn(async () =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: configuredBlogSettings }),
      } as Response),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const { default: AdminSettingsPage } = await import("../settings/page");
      const ui = await AdminSettingsPage();

      render(ui as React.ReactElement);

      fireEvent.click(screen.getByRole("tab", { name: /公开个人信息栏/ }));
      fireEvent.change(screen.getByLabelText("作者副标题"), { target: { value: "Only profile changed" } });
      fireEvent.click(screen.getByRole("button", { name: "保存博客配置" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/settings/blog",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            profile: {
              ...configuredBlogSettings.profile,
              subtitle: "Only profile changed",
            },
          }),
        }),
      ));

      const requestInit = (fetchMock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit])[1];
      const requestBody = JSON.parse(requestInit.body as string);
      expect(requestBody.siteName).toBeUndefined();
      expect(requestBody.about).toBeUndefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
