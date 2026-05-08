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
    render(<LoginForm mode="page" authError="not-admin" />);

    expect(screen.getByText("编辑工作台")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "后台登录" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /进入后台/ })).toBeInTheDocument();
    expect(screen.getByText(/再由管理员分配后台权限/)).toBeInTheDocument();
    expect(screen.getByText(/管理员账号/)).toBeInTheDocument();
  });

  test("uses generic account copy for dialog mode", () => {
    const { container } = render(<LoginForm mode="dialog" />);

    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
    expect(screen.getByText(/收藏文章/)).toBeInTheDocument();
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

    expect(await screen.findByText("CredentialsSignin")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
  });
});
