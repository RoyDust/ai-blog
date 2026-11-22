import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
});
