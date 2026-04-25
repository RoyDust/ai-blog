"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

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
  bulkActions = [],
}: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter((id) => rows.some((row) => row.id === id)),
    [rows, selectedIds],
  );
  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => visibleSelectedIds.includes(row.id)),
    [rows, visibleSelectedIds],
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
      return;
    }

    setSelectedIds(rows.map((row) => row.id));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  return (
    <section className="ui-surface overflow-hidden rounded-3xl shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{summary ?? `共 ${rows.length} 条记录`}</p>
        </div>
        {densityLabel ? (
          <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-medium text-[var(--muted)]">{densityLabel}</span>
        ) : null}
      </header>

      {toolbar ? <div className="border-b border-[var(--border)] px-4 py-3">{toolbar}</div> : null}

      {bulkActions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--foreground)]">批量操作</span>
          <span className="text-xs text-[var(--muted)]">已选 {visibleSelectedIds.length} 项</span>
          {bulkActions.map((action) => (
            <button
              key={action.label}
              className={
                action.variant === "danger"
                  ? "ui-btn rounded-xl bg-rose-600 px-3 py-1.5 text-xs text-white hover:bg-rose-700"
                  : "ui-btn rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs text-white hover:opacity-92"
              }
              disabled={visibleSelectedIds.length === 0 || action.disabled}
              onClick={() => action.onClick(visibleSelectedIds)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">{loadingLabel}</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px]">
            <thead className="bg-[var(--surface-alt)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <input checked={allSelected} onChange={toggleAll} type="checkbox" aria-label="全选" />
                </th>
                {columns.map((column) => (
                  <th
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]"
                    key={column.key}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr className="transition-colors hover:bg-[var(--surface-alt)]/60" key={row.id}>
                  <td className="px-4 py-3 align-top">
                    <input checked={visibleSelectedIds.includes(row.id)} onChange={() => toggleOne(row.id)} type="checkbox" aria-label={`选择 ${row.id}`} />
                  </td>
                  {columns.map((column) => (
                    <td className={`px-4 py-3 align-top text-sm text-[var(--foreground)] ${column.className ?? ""}`} key={column.key}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
