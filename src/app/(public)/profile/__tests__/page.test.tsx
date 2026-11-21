import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  apiMutate,
  findUnique,
  getBlogSettings,
  getServerSession,
  redirect,
  refresh,
  toastError,
  toastSuccess,
  updateSession,
} = vi.hoisted(() => ({
  apiMutate: vi.fn(),
  findUnique: vi.fn(),
  getBlogSettings: vi.fn(async () => ({
    siteName: "Inkforge Studio",
    siteDescription: "工程与创作笔记",
    siteUrl: "https://inkforge.example",
  })),
  getServerSession: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  updateSession: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: { user: { id: "user-1", role: "USER" } },
    status: "authenticated",
    update: updateSession,
  }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ refresh }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

vi.mock("@/lib/client-api", () => ({
  apiMutate,
  toErrorMessage: (error: unknown, fallback = "请求失败，请稍后重试") =>
    error instanceof Error && error.message.trim() ? error.message : fallback,
}));

import ProfilePage, { dynamic, generateMetadata } from "../page";

describe("public /profile page", () => {
  beforeEach(() => {
    apiMutate.mockReset();
    findUnique.mockReset();
    getBlogSettings.mockClear();
    getServerSession.mockReset();
    redirect.mockReset();
    refresh.mockReset();
    toastError.mockReset();
    toastSuccess.mockReset();
    updateSession.mockReset();
  });

  test("opts into dynamic rendering and generates noindex metadata", async () => {
    expect(dynamic).toBe("force-dynamic");

    const metadata = await generateMetadata();
    expect(metadata).toMatchObject({
      title: "个人资料",
      alternates: { canonical: "https://inkforge.example/profile" },
      robots: { index: false, follow: true },
    });
  });

  test("redirects unauthenticated visitors cleanly to /?login=1&callbackUrl=%2Fprofile without not-admin error", async () => {
    getServerSession.mockResolvedValueOnce(null);

    await ProfilePage();

    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/?login=1&callbackUrl=%2Fprofile");
    expect(redirect.mock.calls[0]?.[0]).not.toContain("not-admin");
    expect(redirect.mock.calls[0]?.[0]).not.toContain("/admin");
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("renders editorial profile form for USER without /admin links and submits PATCH /api/users/me cleanly", async () => {
    getServerSession.mockResolvedValueOnce({
      user: { id: "reader-1", role: "USER" },
    });
    findUnique.mockResolvedValueOnce({
      id: "reader-1",
      name: "林舟",
      email: "reader@example.com",
      image: null,
      role: "USER",
      createdAt: new Date("2026-05-12T08:00:00.000Z"),
    });
    apiMutate.mockResolvedValueOnce({
      success: true,
      data: {
        id: "reader-1",
        name: "林舟的新名字",
        email: "new-reader@example.com",
        image: "https://example.com/new-avatar.png",
      },
    });

    const ui = await ProfilePage();
    const { container } = render(ui as React.ReactElement);

    expect(redirect).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { level: 1, name: "个人资料" })).toHaveClass("ed-serif");
    expect(screen.getByText(/账号身份：读者账号（USER）/)).toBeInTheDocument();
    expect(screen.getByText(/注册日期：2026-05-12/)).toBeInTheDocument();

    // USER 角色页面绝不包含任何 /admin 链接，也不使用圆角玻璃卡片
    const allLinks = screen.getAllByRole("link");
    for (const link of allLinks) {
      expect(link.getAttribute("href")).not.toMatch(/^\/admin/);
    }
    expect(container.querySelector(".card-base, .reader-panel, .reader-card, svg")).toBeNull();
    expect(container.querySelectorAll(".ed-btn")).toHaveLength(1);
    expect(screen.queryByLabelText(/当前登录密码/)).not.toBeInTheDocument();

    // 仅大小写差异不视为更换邮箱，不弹出密码输入框
    fireEvent.change(screen.getByLabelText(/邮箱/), { target: { value: "  READER@Example.com " } });
    expect(screen.queryByLabelText(/当前登录密码/)).not.toBeInTheDocument();

    // 修改为新邮箱后，展示方向 A 密码重认证输入框，未填密码时阻止提交并展示中文校验提示
    fireEvent.change(screen.getByLabelText(/显示名称/), { target: { value: "林舟的新名字" } });
    fireEvent.change(screen.getByLabelText(/邮箱/), { target: { value: "  New-Reader@Example.com " } });
    fireEvent.change(screen.getByLabelText(/头像链接/), {
      target: { value: "https://example.com/new-avatar.png" },
    });

    const passwordInput = screen.getByLabelText(/当前登录密码/);
    expect(passwordInput).toHaveClass("ed-input");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(container.querySelector(".card-base, .reader-panel, .reader-card, svg")).toBeNull();
    expect(container.querySelectorAll(".ed-btn")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByText("修改登录邮箱需验证当前登录密码")).toHaveClass("ed-field-error");
    expect(apiMutate).not.toHaveBeenCalled();

    fireEvent.change(passwordInput, { target: { value: "reader-secret-123" } });
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => {
      expect(apiMutate).toHaveBeenCalledWith("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: "林舟的新名字",
          email: "new-reader@example.com",
          image: "https://example.com/new-avatar.png",
          currentPassword: "reader-secret-123",
        }),
      });
    });

    expect(updateSession).toHaveBeenCalledWith({
      name: "林舟的新名字",
      email: "new-reader@example.com",
      image: "https://example.com/new-avatar.png",
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith("个人资料已保存");
    expect(screen.getByText("林舟的新名字")).toBeInTheDocument();
    expect(screen.queryByLabelText(/当前登录密码/)).not.toBeInTheDocument();
  });

  test("allows saving name and avatar without currentPassword when email stays unchanged", async () => {
    getServerSession.mockResolvedValueOnce({
      user: { id: "reader-1", role: "USER" },
    });
    findUnique.mockResolvedValueOnce({
      id: "reader-1",
      name: "林舟",
      email: "reader@example.com",
      image: null,
      role: "USER",
      createdAt: new Date("2026-05-12T08:00:00.000Z"),
    });
    apiMutate.mockResolvedValueOnce({
      success: true,
      data: {
        id: "reader-1",
        name: "林舟更新",
        email: "reader@example.com",
        image: null,
      },
    });

    const ui = await ProfilePage();
    render(ui as React.ReactElement);

    fireEvent.change(screen.getByLabelText(/显示名称/), { target: { value: "林舟更新" } });
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => {
      expect(apiMutate).toHaveBeenCalledWith("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: "林舟更新",
          email: "reader@example.com",
          image: null,
        }),
      });
    });
  });

  test("validates fields and maps duplicate email API errors to Chinese toast", async () => {
    getServerSession.mockResolvedValueOnce({
      user: { id: "reader-1", role: "USER" },
    });
    findUnique.mockResolvedValueOnce({
      id: "reader-1",
      name: "林舟",
      email: "reader@example.com",
      image: "",
      role: "USER",
      createdAt: new Date("2026-05-12T08:00:00.000Z"),
    });

    const ui = await ProfilePage();
    render(ui as React.ReactElement);

    fireEvent.change(screen.getByLabelText(/显示名称/), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText(/头像链接/), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    expect(await screen.findByText("请输入显示名称")).toHaveClass("ed-field-error");
    expect(screen.getByText("请输入以 http:// 或 https:// 开头的有效图片链接")).toHaveClass("ed-field-error");
    expect(apiMutate).not.toHaveBeenCalled();

    apiMutate.mockRejectedValueOnce(new Error("Email already in use"));
    fireEvent.change(screen.getByLabelText(/显示名称/), { target: { value: "林舟" } });
    fireEvent.change(screen.getByLabelText(/邮箱/), { target: { value: "taken@example.com" } });
    fireEvent.change(screen.getByLabelText(/当前登录密码/), { target: { value: "correct-password" } });
    fireEvent.change(screen.getByLabelText(/头像链接/), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存资料" }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("该邮箱已被其他账号使用");
    });
  });

  test("shows secondary admin account settings TextLink only for ADMIN users", async () => {
    getServerSession.mockResolvedValueOnce({
      user: { id: "admin-1", role: "ADMIN" },
    });
    findUnique.mockResolvedValueOnce({
      id: "admin-1",
      name: "RoyDust",
      email: "admin@example.com",
      image: "https://example.com/admin.png",
      role: "ADMIN",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const ui = await ProfilePage();
    render(ui as React.ReactElement);

    const adminLink = screen.getByRole("link", { name: /前往后台账号与站点设置/ });
    expect(adminLink).toHaveClass("ed-link");
    expect(adminLink).toHaveAttribute("href", "/admin/settings?tab=account");
    expect(adminLink).toHaveTextContent("→");
  });
});
