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

const emptyRows: Array<{ id: string; name: string }> = [];

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

    fireEvent.click(screen.getByRole("checkbox", { name: "选择第 1 行" }));

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

  test("uses server pagination metadata without slicing current rows", () => {
    const onPageChange = vi.fn();

    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        onPageChange={onPageChange}
        pagination={{ page: 3, limit: 10, total: 42, totalPages: 5 }}
        rows={rows.slice(0, 10)}
        title="服务端表格"
      />,
    );

    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("显示第 21 到 30 条，共 42 条记录")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  test("supports fixed-height internal scrolling", () => {
    const { container } = render(
      <DataTable
        fillHeight
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        pageSize={10}
        rows={rows}
        title="固定高度表格"
      />,
    );

    const card = container.querySelector('[data-slot="card"]');
    const section = card?.querySelector("section");
    const scrollContainer = screen.getByTestId("admin-data-table-scroll");
    const tableHeader = container.querySelector('[data-slot="table-header"]');
    const pagination = screen.getByText("显示第 1 到 10 条，共 12 条记录").closest("footer");

    expect(card).toHaveClass("flex", "min-h-0", "flex-1", "overflow-hidden");
    expect(section).toHaveClass("flex", "min-h-0", "flex-1", "flex-col");
    expect(scrollContainer).toHaveClass("min-h-0", "flex-1", "overflow-auto");
    expect(tableHeader).toHaveClass("sticky", "top-0");
    expect(pagination).toHaveClass("shrink-0");
  });

  test("labels row checkboxes with 1-based row numbers", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        pageSize={10}
        rows={rows}
        title="测试表格"
      />,
    );

    expect(screen.getByRole("checkbox", { name: "选择第 1 行" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "选择第 10 行" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "选择第 11 行" })).not.toBeInTheDocument();
  });

  test("renders a custom emptyState inside role=status when provided", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyState={<div>自定义空态</div>}
        emptyText="暂无数据"
        rows={emptyRows}
        title="测试表格"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("自定义空态");
    expect(screen.queryByText("暂无数据")).not.toBeInTheDocument();
  });

  test("renders the default Empty component for empty rows inside role=status", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        rows={emptyRows}
        title="测试表格"
      />,
    );

    const status = screen.getByRole("status");
    expect(status.querySelector('[data-slot="empty"]')).toBeInTheDocument();
    expect(screen.getByText("暂无数据")).toBeInTheDocument();
  });

  test("announces the loading state via role=status", () => {
    render(
      <DataTable
        columns={[{ key: "name", label: "名称", render: (row) => row.name }]}
        emptyText="暂无数据"
        isLoading
        loadingLabel="加载中..."
        rows={emptyRows}
        title="测试表格"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("加载中...");
  });
});
