"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/shadcn/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/shadcn/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { cn } from "@/lib/utils";

export interface DataColumn<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T extends { id: string }> {
  title: string;
  rows: T[];
  columns: DataColumn<T>[];
  emptyText: string;
  summary?: string;
  toolbar?: ReactNode;
  isLoading?: boolean;
  loadingLabel?: string;
  densityLabel?: string;
  pageSize?: number;
  pageSizeOptions?: number[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  fillHeight?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  bulkActions?: Array<{
    label: string;
    onClick: (ids: string[]) => void;
    disabled?: boolean;
    variant?: "default" | "danger";
  }>;
}

export function DataTable<T extends { id: string }>({
  title,
  rows,
  columns,
  emptyText,
  summary,
  toolbar,
  isLoading = false,
  loadingLabel = "加载中...",
  densityLabel,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 20, 50, 100],
  pagination,
  fillHeight = false,
  onPageChange,
  onPageSizeChange,
  bulkActions = [],
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(initialPageSize);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const usesServerPagination = Boolean(pagination);

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => rows.some((row) => row.id === id)),
    [rows, selectedIds],
  );

  const pageSize = pagination?.limit ?? clientPageSize;
  const totalRows = pagination?.total ?? rows.length;
  const totalPages = pagination?.totalPages ?? Math.ceil(rows.length / clientPageSize);
  const activePage = usesServerPagination ? pagination?.page ?? 1 : Math.min(currentPage, totalPages || 1);

  const paginatedRows = useMemo(() => {
    if (usesServerPagination) return rows;
    if (rows.length <= pageSize) return rows;
    const start = (activePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [activePage, pageSize, rows, usesServerPagination]);
  const currentPageIds = useMemo(() => paginatedRows.map((row) => row.id), [paginatedRows]);
  const allCurrentPageSelected = useMemo(
    () => currentPageIds.length > 0 && currentPageIds.every((id) => visibleSelectedIds.includes(id)),
    [currentPageIds, visibleSelectedIds],
  );
  const isCurrentPagePartiallySelected = useMemo(
    () => !allCurrentPageSelected && currentPageIds.some((id) => visibleSelectedIds.includes(id)),
    [allCurrentPageSelected, currentPageIds, visibleSelectedIds],
  );

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isCurrentPagePartiallySelected;
    }
  }, [isCurrentPagePartiallySelected]);

  const toggleAll = () => {
    if (allCurrentPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !currentPageIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...currentPageIds])));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const statusClassName = fillHeight
    ? "flex min-h-0 flex-1 items-center justify-center px-4 py-16 text-center text-sm text-slate-500"
    : "px-4 py-16 text-center text-sm text-slate-500";

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-lg border-slate-200 bg-white py-0 text-slate-950 shadow-none",
        fillHeight && "flex min-h-0 flex-1 flex-col",
      )}
    >
      <section className={cn(fillHeight && "flex min-h-0 flex-1 flex-col")}>
        <CardHeader className="shrink-0 gap-0 border-b border-slate-200 px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-slate-950">{title}</CardTitle>
              <p className="mt-1 text-xs text-slate-500">{summary ?? `共 ${totalRows} 条记录`}</p>
            </div>
            {densityLabel ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">{densityLabel}</span>
            ) : null}
          </div>
        </CardHeader>

        {toolbar ? <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">{toolbar}</div> : null}

        {bulkActions.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">批量操作</span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">已选 {visibleSelectedIds.length} 项</span>
            <div className="flex items-center gap-2">
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  disabled={visibleSelectedIds.length === 0 || action.disabled}
                  onClick={() => action.onClick(visibleSelectedIds)}
                  size="sm"
                  type="button"
                  variant={action.variant === "danger" ? "destructive" : "outline"}
                  className={cn(
                    "h-8 rounded-md shadow-none",
                    action.variant !== "danger" && "!border-slate-200 !bg-white !text-slate-700 hover:!bg-slate-50",
                  )}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className={statusClassName}>{loadingLabel}</p>
        ) : rows.length === 0 ? (
          <p className={statusClassName}>{emptyText}</p>
        ) : (
          <div className={cn(fillHeight ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto")} data-testid="admin-data-table-scroll">
            <Table className="min-w-[860px] table-fixed xl:min-w-[1080px]">
              <TableHeader className={cn("border-b border-slate-200 bg-[#f8faf8] shadow-[0_1px_0_rgba(15,23,42,0.06)]", fillHeight && "sticky top-0 z-10")}>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-12 px-4 py-3.5 text-center">
                    <input
                      ref={headerCheckboxRef}
                      checked={allCurrentPageSelected}
                      onChange={toggleAll}
                      type="checkbox"
                      aria-label="选择当前页"
                      aria-checked={isCurrentPagePartiallySelected ? "mixed" : allCurrentPageSelected}
                      className="size-4 cursor-pointer rounded border-slate-300 bg-white text-cyan-600 focus:ring-cyan-500/25 focus:ring-offset-0"
                    />
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.key} className="py-3.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRows.map((row) => {
                  const isRowSelected = visibleSelectedIds.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "border-slate-100 transition-colors hover:bg-slate-50/80",
                        isRowSelected && "bg-cyan-50/70 hover:bg-cyan-50",
                      )}
                    >
                      <TableCell className="px-4 py-4 text-center align-top">
                        <input
                          checked={isRowSelected}
                          onChange={() => toggleOne(row.id)}
                          type="checkbox"
                          aria-label={`选择 ${row.id}`}
                          className="size-4 cursor-pointer rounded border-slate-300 bg-white text-cyan-600 focus:ring-cyan-500/25 focus:ring-offset-0"
                        />
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell className={cn("whitespace-normal py-4 align-top text-sm text-slate-600", column.className)} key={column.key}>
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {!isLoading && rows.length > 0 ? (
          <AdminPagination
            className={fillHeight ? "shrink-0" : undefined}
            itemLabel="条记录"
            onPageChange={usesServerPagination ? onPageChange : setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              if (usesServerPagination) {
                onPageSizeChange?.(nextPageSize);
                return;
              }

              setClientPageSize(nextPageSize);
              setCurrentPage(1);
            }}
            page={activePage}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            total={totalRows}
            totalPages={Math.max(totalPages, 1)}
          />
        ) : null}
      </section>
    </Card>
  );
}
