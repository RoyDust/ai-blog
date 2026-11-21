import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { push, apiMutate, toastError, signIn } = vi.hoisted(() => ({
  push: vi.fn(),
  apiMutate: vi.fn(),
  toastError: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

vi.mock("next-auth/react", () => ({ signIn }));

vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

vi.mock("@/lib/client-api", () => ({
  apiMutate,
  toErrorMessage: (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback),
}));

import RegisterPage from "../page";

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "林舟" } });
  fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "linzhou@example.com" } });
  fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password-123" } });
  fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "password-123" } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("register page", () => {
  beforeEach(() => {
    push.mockReset();
    apiMutate.mockReset();
    toastError.mockReset();
    signIn.mockReset();
  });

  test("renders the editorial account form with a left-aligned header", () => {
    const { container } = render(<RegisterPage />);

    const heading = screen.getByRole("heading", { level: 1, name: "创建账号" });
    expect(heading).toHaveClass("ed-serif");
    expect(heading.closest("header")).toHaveClass("border-b-2");
    expect(heading.closest("header")?.className).not.toContain("text-center");
    expect(screen.getByText("至少 8 位")).toHaveClass("ed-field-hint");
    expect(screen.getByRole("checkbox")).toHaveClass("ed-checkbox");
    expect(screen.getByRole("button", { name: "创建账号" })).toHaveClass("ed-btn", "ed-btn--block");
    expect(screen.getByRole("button", { name: "使用 GitHub 注册" })).toHaveClass("ed-btn-outline", "ed-btn--block");
    expect(screen.getByRole("link", { name: "去登录" })).toHaveAttribute("href", expect.stringContaining("login=1"));
    expect(container.querySelector("svg, .card-base")).toBeNull();
  });

  test("shows field errors for nickname, password length, mismatch and unchecked terms", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "123" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByText("请输入昵称")).toHaveClass("ed-field-error");
    expect(screen.getByText("密码至少 8 位")).toBeInTheDocument();
    // 出错时「至少 8 位」辅助说明被错误文案替换
    expect(screen.queryByText("至少 8 位")).not.toBeInTheDocument();
    expect(screen.getByText("请先同意服务条款与隐私政策")).toHaveClass("ed-field-error");
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-invalid", "true");
    expect(apiMutate).not.toHaveBeenCalled();
  });

  test("flags mismatched passwords", async () => {
    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText("昵称"), { target: { value: "林舟" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "linzhou@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password-123" } });
    fireEvent.change(screen.getByLabelText("确认密码"), { target: { value: "password-456" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByText("两次输入的密码不一致")).toBeInTheDocument();
  });

  test("submits, shows the pending label and sends the reader to the login prompt", async () => {
    let resolve: (value: unknown) => void = () => {};
    apiMutate.mockReturnValueOnce(new Promise((next) => (resolve = next)));

    render(<RegisterPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    expect(await screen.findByRole("button", { name: "正在创建..." })).toBeDisabled();
    expect(apiMutate).toHaveBeenCalledWith("/api/auth/register", expect.objectContaining({ method: "POST" }));

    resolve({ success: true });
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("registered=true")));
  });

  test("reports failures through a toast", async () => {
    apiMutate.mockRejectedValueOnce(new Error("该邮箱已注册"));

    render(<RegisterPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "创建账号" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("该邮箱已注册"));
    expect(push).not.toHaveBeenCalled();
  });
});
