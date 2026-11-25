import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicCommandSearch } from "../PublicCommandSearch";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("PublicCommandSearch", () => {
  const originalPlatform = window.navigator.platform;

  beforeEach(() => {
    push.mockReset();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "Win32",
    });
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalPlatform,
    });
    vi.restoreAllMocks();
  });

  test("renders lightweight trigger button initially and lazily mounts the command dialog on Ctrl+K", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ThemeProvider>
          <PublicCommandSearch />
        </ThemeProvider>
      </SWRConfig>,
    );

    const trigger = screen.getByRole("button", { name: "快速搜索与命令面板" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveTextContent("Ctrl K");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("输入关键词搜索文章")).toBeInTheDocument();
  });

  test("displays Apple ⌘K shortcut on macOS devices and opens via trigger click", async () => {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: "MacIntel",
    });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ThemeProvider>
          <PublicCommandSearch />
        </ThemeProvider>
      </SWRConfig>,
    );

    const trigger = screen.getByRole("button", { name: "快速搜索与命令面板" });
    expect(trigger).toHaveTextContent("⌘K");

    fireEvent.click(trigger);

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  test("navigates to highlighted item on ArrowDown + Enter and closes dialog", async () => {
    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ThemeProvider>
          <PublicCommandSearch />
        </ThemeProvider>
      </SWRConfig>,
    );

    fireEvent.click(screen.getByRole("button", { name: "快速搜索与命令面板" }));
    const input = await screen.findByLabelText("输入关键词搜索文章");

    // autoHighlight="always" 默认高亮首项「首页」，按一次 ArrowDown 移动到第二项「原创文章」
    await waitFor(() => {
      expect(screen.getByText("首页").closest('[role="option"]')).toHaveAttribute("data-highlighted");
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByText("原创文章").closest('[role="option"]')).toHaveAttribute("data-highlighted");
    });

    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/posts?type=original");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  test("clears controlled query when dialog is dismissed without selecting an item", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: [], pagination: { total: 0 } }),
      }),
    );

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <ThemeProvider>
          <PublicCommandSearch />
        </ThemeProvider>
      </SWRConfig>,
    );

    const trigger = screen.getByRole("button", { name: "快速搜索与命令面板" });
    fireEvent.click(trigger);

    const input = await screen.findByLabelText("输入关键词搜索文章");
    fireEvent.change(input, { target: { value: "Next.js" } });
    expect(input).toHaveValue("Next.js");

    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);
    const reopenedInput = await screen.findByLabelText("输入关键词搜索文章");
    expect(reopenedInput).toHaveValue("");
  });
});
