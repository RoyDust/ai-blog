import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(),
}));

import { GitHubBinding } from "../GitHubBinding";

describe("GitHubBinding 解绑确认流", () => {
  beforeEach(() => {
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  test("解绑需先确认：确认后调用解绑接口并提示成功", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GitHubBinding initialLinked />);

    fireEvent.click(screen.getByRole("button", { name: "解除 GitHub 绑定" }));

    expect(screen.getByText("确定要解除 GitHub 绑定吗？解绑后将无法使用 GitHub 登录。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认解绑" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/account/github/unlink",
        expect.objectContaining({ method: "POST" }),
      );
      expect(toastSuccessMock).toHaveBeenCalledWith("GitHub 已解除绑定");
    });
  });

  test("解绑确认弹窗取消时不调用解绑接口", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<GitHubBinding initialLinked />);

    fireEvent.click(screen.getByRole("button", { name: "解除 GitHub 绑定" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("解绑失败时通过 toast.error 反馈", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<GitHubBinding initialLinked />);

    fireEvent.click(screen.getByRole("button", { name: "解除 GitHub 绑定" }));
    fireEvent.click(screen.getByRole("button", { name: "确认解绑" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("服务器内部错误，请稍后重试");
    });
  });
});
