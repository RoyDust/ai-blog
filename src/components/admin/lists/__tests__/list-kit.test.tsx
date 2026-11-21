import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ListCheckboxToggle, ListTabs, MetricStrip, SelectionSwap } from "@/components/admin/lists";

describe("admin list kit", () => {
  test("MetricStrip renders filterable items as aria-pressed buttons and display-only items as plain cells", () => {
    const onSelect = vi.fn();
    render(
      <MetricStrip
        ariaLabel="按状态筛选"
        items={[
          { key: "all", label: "全部", value: "48", note: "总内容池", pressed: true, onSelect: vi.fn() },
          { key: "draft", label: "草稿", value: "12", note: "待校稿", pressed: false, onSelect },
          { key: "views", label: "阅读", value: "18,426", note: "累计阅读" },
        ]}
      />,
    );

    const group = screen.getByRole("group", { name: "按状态筛选" });
    expect(group).toHaveAttribute("data-slot", "admin-metric-strip");
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveAttribute("aria-pressed", "true");
    expect(buttons[1]).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("18,426").closest("button")).toBeNull();

    fireEvent.click(buttons[1]);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test("ListTabs marks the current tab with aria-pressed and reports changes", () => {
    const onChange = vi.fn();
    render(
      <ListTabs
        ariaLabel="发布状态"
        items={[
          { value: "all", label: "全部内容" },
          { value: "draft", label: "仅看草稿" },
        ]}
        onChange={onChange}
        value="all"
      />,
    );

    expect(screen.getByRole("button", { name: "全部内容" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "仅看草稿" }));
    expect(onChange).toHaveBeenCalledWith("draft");
  });

  test("ListCheckboxToggle is a labelled checkbox", () => {
    const onChange = vi.fn();
    render(<ListCheckboxToggle checked={false} label="非 AI 日报" onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "非 AI 日报" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test("SelectionSwap shows the idle hint until something is selected, then 已选 N + bulk buttons", () => {
    const { rerender } = render(
      <SelectionSwap count={0} idle="勾选文章后显示批量操作">
        <button type="button">批量发布</button>
      </SelectionSwap>,
    );

    expect(screen.getByText("勾选文章后显示批量操作")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量发布" })).not.toBeInTheDocument();

    rerender(
      <SelectionSwap count={3} idle="勾选文章后显示批量操作">
        <button type="button">批量发布</button>
      </SelectionSwap>,
    );

    expect(screen.getByRole("group", { name: "批量操作" })).toHaveTextContent("已选 3");
    expect(screen.getByRole("button", { name: "批量发布" })).toBeInTheDocument();
  });
});
