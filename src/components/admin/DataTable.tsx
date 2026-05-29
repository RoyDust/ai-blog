"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/admin/ui";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";

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
  bulkActions = [],
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => rows.some((row) => row.id === id)),
    [rows, selectedIds],
  );

  const totalPages = Math.ceil(rows.length / pageSize);
  const activePage = Math.min(currentPage, totalPages || 1);

  const paginatedRows = useMemo(() => {
    if (rows.length <= pageSize) return rows;
    const start = (activePage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, activePage, pageSize]);
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

  return (
    <Card className="gap-0 overflow-hidden rounded-3xl py-0 border border-slate-100/80 dark:border-slate-800/50 shadow-sm transition-all duration-300">
      <section>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight text-[var(--foreground)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{summary ?? `共 ${rows.length} 条记录`}</p>
          </div>
          {densityLabel ? (
            <span className="rounded-full bg-blue-50/60 dark:bg-blue-900/10 px-3 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">{densityLabel}</span>
          ) : null}
        </header>

        {toolbar ? <div className="border-b border-[var(--border)] px-5 py-3.5 bg-slate-50/20 dark:bg-slate-900/5">{toolbar}</div> : null}

        {bulkActions.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-blue-50/10 dark:bg-slate-900/20 px-5 py-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">批量操作</span>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50/85 dark:bg-blue-900/20 px-2 py-0.5 rounded-md">已选 {visibleSelectedIds.length} 项</span>
            <div className="flex items-center gap-2">
              {bulkActions.map((action) => (
                <Button
                  key={action.label}
                  disabled={visibleSelectedIds.length === 0 || action.disabled}
                  onClick={() => action.onClick(visibleSelectedIds)}
                  size="sm"
                  type="button"
                  variant={action.variant === "danger" ? "danger" : "primary"}
                  className="rounded-xl shadow-xs transition-transform duration-200 active:scale-95"
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <p className="px-4 py-16 text-center text-sm text-[var(--muted)]">{loadingLabel}</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-[var(--muted)]">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/40 dark:bg-slate-900/30 border-b border-[var(--border)]">
                <TableRow className="hover:bg-transparent border-0">
                  <TableHead className="w-12 text-center py-3.5">
                    <input
                      ref={headerCheckboxRef}
                      checked={allCurrentPageSelected}
                      onChange={toggleAll}
                      type="checkbox"
                      aria-label="选择当前页"
                      aria-checked={isCurrentPagePartiallySelected ? "mixed" : allCurrentPageSelected}
                      className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/25 focus:ring-offset-0 bg-[var(--surface)] transition-all cursor-pointer size-4"
                    />
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.key} className="font-bold text-slate-700 dark:text-slate-300 py-3.5 text-xs uppercase tracking-wider">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
                {paginatedRows.map((row) => {
                  const isRowSelected = visibleSelectedIds.includes(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      className={`transition-colors duration-200 border-b border-[var(--border)] last:border-0 hover:bg-blue-50/20 dark:hover:bg-slate-800/10 ${
                        isRowSelected ? "bg-blue-50/10 dark:bg-blue-900/5" : ""
                      }`}
                    >
                      <TableCell className="text-center py-4">
                        <input
                          checked={isRowSelected}
                          onChange={() => toggleOne(row.id)}
                          type="checkbox"
                          aria-label={`选择 ${row.id}`}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500/25 focus:ring-offset-0 bg-[var(--surface)] transition-all cursor-pointer size-4"
                        />
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell className={`py-4 text-sm text-slate-600 dark:text-slate-300 ${column.className || ""}`} key={column.key}>
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
            itemLabel="条记录"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setCurrentPage(1);
            }}
            page={activePage}
            pageSize={pageSize}
            pageSizeOptions={pageSizeOptions}
            total={rows.length}
            totalPages={Math.max(totalPages, 1)}
          />
        ) : null}
      </section>
    </Card>
  );
}
