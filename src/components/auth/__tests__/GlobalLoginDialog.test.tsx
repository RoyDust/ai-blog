import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GlobalLoginDialog } from "../GlobalLoginDialog";

const { refresh, replace, searchParams } = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
  searchParams: { value: "login=1&error=not-admin&callbackUrl=%2Fadmin" },
}));

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh, replace }),
  useSearchParams: () => new URLSearchParams(searchParams.value),
}));

describe("GlobalLoginDialog", () => {
  beforeEach(() => {
    refresh.mockReset();
    replace.mockReset();
    searchParams.value = "login=1&error=not-admin&callbackUrl=%2Fadmin";
  });

  test("opens the login dialog from query params and passes auth errors through", async () => {
    render(<GlobalLoginDialog />);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
    expect(screen.getByText(/管理员账号/)).toBeInTheDocument();
  });

  test("clears login query params when the dialog closes", async () => {
    render(<GlobalLoginDialog />);

    fireEvent.click(await screen.findByRole("button", { name: "关闭登录弹窗" }));

    expect(replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
