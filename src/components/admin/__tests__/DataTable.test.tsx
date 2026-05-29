import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { DataTable } from "../DataTable";

const rows = Array.from({ length: 12 }, (_, index) => ({
  id: String(index + 1),
  name: `Row ${index + 1}`,
}));

describe("DataTable", () => {
  test("selects only the current page from the header checkbox", () => {
    const onBulk = vi.fn();

    render(
      <DataTable
        bulkActions={[{ label: "执行批量", onClick: onBulk }]}
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        pageSize={10}
        rows={rows}
        title="测试表格"
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择当前页" }));
    fireEvent.click(screen.getByRole("button", { name: "执行批量" }));

    expect(screen.getByText("已选 10 项")).toBeInTheDocument();
    expect(onBulk).toHaveBeenCalledWith(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  });

  test("marks the header checkbox as mixed when only part of the current page is selected", () => {
    render(
      <DataTable
        bulkActions={[{ label: "执行批量", onClick: vi.fn() }]}
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        pageSize={10}
        rows={rows}
        title="测试表格"
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "选择 1" }));

    const headerCheckbox = screen.getByRole("checkbox", { name: "选择当前页" }) as HTMLInputElement;
    expect(headerCheckbox).not.toBeChecked();
    expect(headerCheckbox.indeterminate).toBe(true);
    expect(headerCheckbox).toHaveAttribute("aria-checked", "mixed");
  });

  test("supports jumping to a specific page", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        pageSize={10}
        rows={rows}
        title="测试表格"
      />,
    );

    expect(screen.queryByText("Row 11")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("跳转页码"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "跳转" }));

    expect(screen.getByText("Row 11")).toBeInTheDocument();
    expect(screen.getByText("显示第 11 到 12 条，共 12 条记录")).toBeInTheDocument();
  });
});
