import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LoginForm } from "../LoginForm";

const { getSession, signIn } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  getSession,
  signIn,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    getSession.mockReset();
    signIn.mockReset();
  });

  test("keeps the admin workspace copy for page mode", () => {
    const { container } = render(<LoginForm mode="page" authError="not-admin" />);

    expect(screen.getByText("编辑工作台")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "后台登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /进入后台/ })).toBeInTheDocument();
    expect(screen.getByText(/再由管理员分配后台权限/)).toBeInTheDocument();
    expect(screen.getByText(/管理员账号/)).toBeInTheDocument();
    // 后台登录自带一张纸面，邮箱占位仍是 admin@example.com
    expect(container.querySelector("[data-login-mode='page']")).toHaveClass("border-[var(--reader-border-strong)]", "bg-[var(--card-bg)]");
    expect(screen.getByLabelText("邮箱")).toHaveAttribute("placeholder", "admin@example.com");
  });

  test("renders the editorial account form: 2px-rule header, no input icons, primary + outline buttons", () => {
    const { container } = render(<LoginForm mode="dialog" />);

    const heading = screen.getByRole("heading", { level: 1, name: "登录账号" });
    expect(heading).toHaveClass("ed-serif");
    expect(heading.closest("header")).toHaveClass("border-b-2", "border-[var(--foreground)]");
    expect(screen.getByText("账号")).toHaveClass("ed-eyebrow");
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByRole("button", { name: /^登录$/ })).toHaveClass("ed-btn", "ed-btn--block");
    expect(screen.getByRole("button", { name: "使用 GitHub 登录" })).toHaveClass("ed-btn-outline", "ed-btn--block");
    expect(screen.getByText("或")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "创建账号" })).toHaveAttribute("href", "/register");
    expect(container.querySelector(".backdrop-blur-xl, .rounded-3xl, .reader-panel")).toBeNull();
  });

  test("shows inline field errors with a danger border on empty submit", async () => {
    render(<LoginForm mode="dialog" />);

    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    expect(await screen.findByText("请输入有效的邮箱地址")).toHaveClass("ed-field-error");
    expect(screen.getByText("请输入密码")).toHaveClass("ed-field-error");
    expect(screen.getByLabelText("邮箱")).toHaveAttribute("aria-invalid", "true");
    expect(signIn).not.toHaveBeenCalled();
  });

  test("uses generic account copy for dialog mode", () => {
    const { container } = render(<LoginForm mode="dialog" />);

    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
    expect(screen.getByText(/收藏文章/)).toBeInTheDocument();
    expect(container.querySelector("[data-login-mode='dialog']")).toBeTruthy();
    expect(screen.getByLabelText("邮箱")).toHaveClass("ed-input");
    expect(screen.getByLabelText("邮箱")).toHaveAttribute("placeholder", "you@example.com");
    expect(container).not.toHaveTextContent("后台登录");
    expect(container).not.toHaveTextContent("进入后台");
    expect(container).not.toHaveTextContent("分配后台权限");
  });

  test("allows targeted copy overrides without replacing every label", () => {
    render(<LoginForm mode="dialog" copy={{ title: "欢迎回来" }} />);

    expect(screen.getByRole("heading", { name: "欢迎回来" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
    expect(screen.getByText(/没有账号/)).toBeInTheDocument();
  });

  test("sends admins to the admin success branch in dialog mode", async () => {
    const onAdminSuccess = vi.fn();
    const onSuccess = vi.fn();

    signIn.mockResolvedValueOnce({ ok: true });
    getSession.mockResolvedValueOnce({ user: { role: "ADMIN" } });

    render(<LoginForm mode="dialog" onAdminSuccess={onAdminSuccess} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    await waitFor(() => expect(onAdminSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test("calls onSuccess for non-admin dialog logins", async () => {
    const onSuccess = vi.fn();

    signIn.mockResolvedValueOnce({ ok: true });
    getSession.mockResolvedValueOnce({ user: { role: "USER" } });

    render(<LoginForm mode="dialog" onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith({ user: { role: "USER" } }));
  });

  test("keeps the dialog open and shows errors when credentials fail", async () => {
    signIn.mockResolvedValueOnce({ error: "CredentialsSignin" });

    render(<LoginForm mode="dialog" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    expect(await screen.findByText("邮箱或密码错误，请重试。")).toHaveClass("ed-banner", "ed-banner--danger");
    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
  });

  test("swaps the submit label and disables the button while signing in", async () => {
    signIn.mockReturnValueOnce(new Promise(() => {}));

    render(<LoginForm mode="dialog" />);

    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    const pending = await screen.findByRole("button", { name: "正在登录..." });
    expect(pending).toBeDisabled();
  });

  test("maps standard NextAuth error codes to Chinese copy", () => {
    render(<LoginForm mode="dialog" authError="OAuthCallback" />);

    expect(screen.getByText(/GitHub 登录回调校验失败/)).toBeInTheDocument();
  });

  test("shows a Chinese retry message when login attempts are rate limited", async () => {
    signIn.mockResolvedValueOnce({ error: "Too many requests" });
    render(<LoginForm mode="dialog" />);
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "admin@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: /^登录$/ }));

    expect(await screen.findByText("登录尝试过于频繁，请一分钟后重试。")).toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  test("falls back to generic copy for unknown error codes", () => {
    render(<LoginForm mode="dialog" authError="SomeUnknownError" />);

    expect(screen.getByText("登录失败，请稍后重试。")).toBeInTheDocument();
  });
});
