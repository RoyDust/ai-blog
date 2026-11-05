"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SkeletonBar } from "@/components/editorial";
import { Button } from "@/components/shadcn/ui/button";
import { Card } from "@/components/shadcn/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/shadcn/ui/empty";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
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
  emptyState?: ReactNode;
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

type BulkAction = NonNullable<DataTableProps<{ id: string }>["bulkActions"]>[number];

/**
 * 批量操作条：勾选后才出现（与文章、评论列表一致，README 第 14 节），「已选 N 项」+ 描边按钮，
 * 破坏性的用 danger 描边；出现 / 收起带高度过渡。
 */
function BulkActionsBar({ actions, selectedIds }: { actions: BulkAction[]; selectedIds: string[] }) {
  const hasSelection = selectedIds.length > 0;
  const reduce = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {hasSelection ? (
        <motion.div
          key="bulk-bar"
          className="shrink-0 overflow-hidden"
          initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <BulkActionsBarContent actions={actions} hasSelection={hasSelection} selectedIds={selectedIds} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function BulkActionsBarContent({
  actions,
  hasSelection,
  selectedIds,
}: {
  actions: BulkAction[];
  hasSelection: boolean;
  selectedIds: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-2.5 text-[0.8125rem]">
      <span className={cn("font-bold tabular-nums", hasSelection ? "text-[var(--foreground)]" : "text-[var(--text-muted)]")}>
        已选 {selectedIds.length} 项
      </span>
      <span aria-hidden="true" className="h-5 w-px bg-[var(--border)]" />
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            disabled={!hasSelection || action.disabled}
            onClick={() => action.onClick(selectedIds)}
            size="sm"
            type="button"
            variant={action.variant === "danger" ? "outline-danger" : "outline"}
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/** 加载骨架：保留表头线，每格一根与真实行同高（44px）的细条 */
function DataTableSkeleton({ className, label, rowCount }: { className?: string; label: string; rowCount: number }) {
  return (
    <div aria-busy="true" className={className} role="status">
      <span className="ed-visually-hidden">{label}</span>
      <div aria-hidden="true" className="border-t border-[var(--reader-border-strong)]">
        {Array.from({ length: rowCount }).map((_, index) => (
          <div key={index} className="flex h-11 items-center gap-6 border-b border-[var(--border)] px-2">
            <SkeletonBar className="size-4" />
            <SkeletonBar strong className="h-3.5 w-[34%]" />
            <SkeletonBar className="h-3 w-[18%]" />
            <SkeletonBar className="h-3 w-[14%]" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DataTable<T extends { id: string }>({
  title,
  rows,
  columns,
  emptyText,
  emptyState,
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

  const reduceMotion = useReducedMotion();
  const statusClassName = fillHeight ? "min-h-0 flex-1" : undefined;
  const emptyStateClassName = fillHeight ? "flex min-h-0 flex-1 items-start" : "flex items-start";

  return (
    <Card
      className={cn(
        "gap-0 text-[var(--foreground)]",
        fillHeight && "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
    >
      <section className={cn(fillHeight && "flex min-h-0 flex-1 flex-col")}>
        {/* 区块标题：衬线标题 + muted 说明 + 1px 细线 + 右侧等宽计数 */}
        <AdminSectionHeader
          aside={
            <span className="ed-mono">
              {densityLabel ?? `第 ${activePage} / ${Math.max(totalPages, 1)} 页 · ${totalRows} 条记录`}
            </span>
          }
          className="shrink-0"
          description={summary}
          title={title}
        />

        {toolbar ? <div className="shrink-0 pt-3 pb-3.5">{toolbar}</div> : null}

        {bulkActions.length > 0 ? <BulkActionsBar actions={bulkActions} selectedIds={visibleSelectedIds} /> : null}

        {isLoading ? (
          <DataTableSkeleton className={statusClassName} label={loadingLabel} rowCount={Math.min(pageSize, 6)} />
        ) : rows.length === 0 ? (
          <div className={emptyStateClassName} role="status">
            {emptyState ?? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>{emptyText}</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
          </div>
        ) : (
          <div className={cn(fillHeight ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto")} data-testid="admin-data-table-scroll">
            <Table className="min-w-[860px] table-fixed xl:min-w-[1080px]">
              <TableHeader className={cn("bg-[var(--card-bg)]", fillHeight && "sticky top-0 z-10")}>
                <TableRow>
                  <TableHead className="w-10 px-2">
                    <input
                      ref={headerCheckboxRef}
                      checked={allCurrentPageSelected}
                      onChange={toggleAll}
                      type="checkbox"
                      aria-label="选择当前页"
                      aria-checked={isCurrentPagePartiallySelected ? "mixed" : allCurrentPageSelected}
                      className="ed-checkbox align-middle"
                    />
                  </TableHead>
                  {columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence initial={false}>
                  {paginatedRows.map((row, rowIndex) => {
                    const isRowSelected = visibleSelectedIds.includes(row.id);
                    const rowNumber = (activePage - 1) * pageSize + rowIndex + 1;
                    return (
                      <motion.tr
                        key={row.id}
                        animate={{ opacity: 1 }}
                        data-slot="table-row"
                        data-state={isRowSelected ? "selected" : undefined}
                        exit={reduceMotion ? undefined : { opacity: 0 }}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="border-b border-[var(--border)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] data-[state=selected]:bg-[color-mix(in_oklab,var(--focus)_7%,transparent)]"
                      >
                        <TableCell className="px-2">
                          <input
                            checked={isRowSelected}
                            onChange={() => toggleOne(row.id)}
                            type="checkbox"
                            aria-label={`选择第 ${rowNumber} 行`}
                            className="ed-checkbox align-middle"
                          />
                        </TableCell>
                        {columns.map((column) => (
                          <TableCell className={cn("overflow-hidden text-[0.8125rem] text-ellipsis", column.className)} key={column.key}>
                            {column.render(row)}
                          </TableCell>
                        ))}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
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
