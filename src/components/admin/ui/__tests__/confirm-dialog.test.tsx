import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  test("renders title, description, labels and impacts area", () => {
    render(
      <ConfirmDialog
        cancelLabel="暂不发布"
        confirmLabel="确认发布"
        description="发布后立即对读者可见。"
        impacts={<p>影响 3 篇文章</p>}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        title="确认发布文章"
      />,
    );

    expect(screen.getByRole("heading", { name: "确认发布文章" })).toBeInTheDocument();
    expect(screen.getByText("发布后立即对读者可见。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "确认发布" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂不发布" })).toBeInTheDocument();
    expect(screen.getByText("影响 3 篇文章")).toBeInTheDocument();
  });

  test("danger tone renders a solid danger confirm button, not the default dark one", () => {
    render(
      <ConfirmDialog
        confirmLabel="确认删除"
        description="删除后不可恢复。"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        title="删除文章"
        tone="danger"
      />,
    );

    const confirm = screen.getByRole("button", { name: "确认删除" });
    expect(confirm).toHaveAttribute("data-variant", "destructive");
    expect(confirm.className).not.toContain("bg-[var(--foreground)]");
    expect(screen.getByText("危险操作")).toBeInTheDocument();
  });

  test("calls onConfirm on confirm and onOpenChange(false) on cancel", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();

    render(
      <ConfirmDialog
        description="描述"
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        open
        title="确认操作"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  test("disables both buttons and shows busy label while submitting", () => {
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        description="描述"
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open
        submitting
        title="确认操作"
      />,
    );

    const confirmButton = screen.getByRole("button", { name: "处理中..." });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
