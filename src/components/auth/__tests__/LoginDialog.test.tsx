import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { LoginDialog } from "../LoginDialog";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("LoginDialog", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  test("renders a flat 30rem paper over the editorial overlay without blur or shadow", () => {
    render(<LoginDialog open onOpenChange={() => {}} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("ed-popover", "max-w-[30rem]");
    expect(dialog.className).not.toMatch(/shadow|backdrop-blur/);

    const overlay = document.querySelector(".ed-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).not.toMatch(/backdrop-blur/);

    expect(screen.getByRole("heading", { level: 1, name: "登录账号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "关闭登录弹窗" })).toHaveClass("ed-icon-btn");
  });

  test("closes through the 44px icon button", () => {
    const onOpenChange = vi.fn();
    render(<LoginDialog open onOpenChange={onOpenChange} />);

    fireEvent.click(screen.getByRole("button", { name: "关闭登录弹窗" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("unmounts the paper after the close transition", async () => {
    const { rerender } = render(<LoginDialog open onOpenChange={() => {}} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    rerender(<LoginDialog open={false} onOpenChange={() => {}} />);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
