import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const { getServerSessionMock, userFindUniqueMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
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

describe("admin settings page", () => {
  test("renders blog settings as static UI and profile settings from the current user", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "ADMIN" } });
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
    expect(screen.getByRole("heading", { name: "个人信息" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "博客配置" })).toBeInTheDocument();
    expect(screen.getByLabelText("显示名称")).toHaveValue("RoyDust");
    expect(screen.getByLabelText("邮箱")).toHaveValue("roy@example.com");
    expect(screen.getByLabelText("头像 URL")).toHaveValue("https://example.com/avatar.png");
    expect(screen.getByRole("button", { name: "编辑头像" })).toBeInTheDocument();
    expect(screen.getByText("点击头像裁切并上传新图片")).toBeInTheDocument();
    expect(screen.getByText("可手动填写远程图片 URL，也可以点击头像裁切上传。留空会移除头像。")).toBeInTheDocument();
    expect(screen.getByLabelText("博客名称")).toHaveValue("roydust.top");
    expect(screen.getByLabelText("站点地址")).toHaveValue("https://roydust.top");
    expect(screen.getByRole("button", { name: "保存个人信息" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "保存博客配置（待接入）" })).toBeDisabled();
  });
});
