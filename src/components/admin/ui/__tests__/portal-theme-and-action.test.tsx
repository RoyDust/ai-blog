import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../index";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("admin UI review regressions", () => {
  beforeEach(() => {
    push.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("AdminGlobalSearch navigates on ArrowDown + Enter and clears query when dismissed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: { results: { posts: [], comments: [] } },
        }),
      }),
    );

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <AdminGlobalSearch />
      </SWRConfig>,
    );

    const trigger = screen.getByRole("button", { name: "打开后台全局搜索" });
    fireEvent.click(trigger);

    const input = await screen.findByLabelText("搜索后台");
    await waitFor(() => {
      expect(screen.getByText("新建文章").closest('[role="option"]')).toHaveAttribute("data-highlighted");
    });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    await waitFor(() => {
      expect(screen.getByText("设置").closest('[role="option"]')).toHaveAttribute("data-highlighted");
    });

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/admin/settings");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // 重新打开输入查询词，再按关闭按钮，再次打开时查询词应被清空
    fireEvent.click(trigger);
    const secondInput = await screen.findByLabelText("搜索后台");
    fireEvent.change(secondInput, { target: { value: "草稿" } });
    expect(secondInput).toHaveValue("草稿");

    fireEvent.click(screen.getByRole("button", { name: "关闭搜索" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(trigger);
    expect(await screen.findByLabelText("搜索后台")).toHaveValue("");
  });

  test("admin TooltipContent and DropdownMenuSubContent portals carry admin-theme scope", async () => {
    render(
      <TooltipProvider delay={0}>
        <Tooltip open>
          <TooltipTrigger render={<button type="button">悬停按钮</button>} />
          <TooltipContent>后台提示气泡</TooltipContent>
        </Tooltip>

        <DropdownMenu open>
          <DropdownMenuContent>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger>更多操作</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>子菜单面板</DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>,
    );

    const tooltipPopup = (await screen.findByText("后台提示气泡")).closest('[data-slot="tooltip-popup"]');
    expect(tooltipPopup).toHaveClass("admin-theme");

    const subMenuPopup = (await screen.findByText("子菜单面板")).closest('[data-slot="menu-sub-content"]');
    expect(subMenuPopup).toHaveClass("admin-theme");
  });

  test("AlertDialogAction with asChild skips child onClick when parent calls preventDefault()", () => {
    const parentClick = vi.fn((event: React.MouseEvent) => {
      event.preventDefault();
    });
    const childClick = vi.fn();

    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>危险确认</AlertDialogTitle>
          <AlertDialogDescription>确认说明</AlertDialogDescription>
          <AlertDialogAction asChild onClick={parentClick}>
            <button onClick={childClick} type="button">
              执行动作
            </button>
          </AlertDialogAction>
        </AlertDialogContent>
      </AlertDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "执行动作" }));
    expect(parentClick).toHaveBeenCalledTimes(1);
    expect(childClick).not.toHaveBeenCalled();
  });
});
