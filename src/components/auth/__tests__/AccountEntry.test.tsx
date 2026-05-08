import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { AccountEntry } from "../AccountEntry";

const { refresh, signOut, useSession } = vi.hoisted(() => ({
  refresh: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signOut,
  useSession,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AccountEntry", () => {
  beforeEach(() => {
    refresh.mockReset();
    signOut.mockReset();
    useSession.mockReset();
  });

  test("renders a stable loading avatar placeholder", () => {
    useSession.mockReturnValue({ data: null, status: "loading" });

    render(<AccountEntry />);

    expect(screen.getByRole("status", { name: "正在加载账号" })).toHaveClass("reader-icon-btn");
  });

  test("opens the generic login dialog for guests", async () => {
    useSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<AccountEntry />);

    fireEvent.click(screen.getByRole("button", { name: "登录账号" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
    expect(screen.queryByText("后台登录")).not.toBeInTheDocument();
  });

  test("shows admin menu entries for admin users", async () => {
    useSession.mockReturnValue({
      data: { user: { name: "RoyDust", email: "roy@example.com", role: "ADMIN" } },
      status: "authenticated",
    });

    render(<AccountEntry />);

    fireEvent.keyDown(screen.getByRole("button", { name: "账号菜单" }), { key: "ArrowDown" });

    expect(await screen.findByText("控制台")).toBeInTheDocument();
    expect(screen.getByText("写文章")).toBeInTheDocument();
    expect(screen.getByText("我的收藏")).toBeInTheDocument();
  });

  test("hides admin menu entries for regular users", async () => {
    useSession.mockReturnValue({
      data: { user: { name: "Reader", email: "reader@example.com", role: "USER" } },
      status: "authenticated",
    });

    render(<AccountEntry />);

    fireEvent.keyDown(screen.getByRole("button", { name: "账号菜单" }), { key: "ArrowDown" });

    expect(await screen.findByText("个人资料")).toBeInTheDocument();
    expect(screen.getByText("我的收藏")).toBeInTheDocument();
    expect(screen.queryByText("控制台")).not.toBeInTheDocument();
    expect(screen.queryByText("写文章")).not.toBeInTheDocument();
  });
});
