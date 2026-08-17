import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Modal } from "../modal";

describe("Modal", () => {
  test("uses ariaLabel as the accessible name when no title is provided", () => {
    render(
      <Modal ariaLabel="确认删除" isOpen onClose={() => {}} showCloseButton={false}>
        弹窗内容
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "确认删除" })).toBeInTheDocument();
    expect(screen.getByText("弹窗内容")).toBeInTheDocument();
  });

  test("renders the visible title when provided", () => {
    render(
      <Modal isOpen onClose={() => {}} title="编辑封面">
        弹窗内容
      </Modal>,
    );

    expect(screen.getByRole("dialog", { name: "编辑封面" })).toBeInTheDocument();
    expect(screen.getByText("编辑封面")).toBeInTheDocument();
  });
});
