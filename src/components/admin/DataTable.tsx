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
  bulkActions?: Array<{
    label: string;
    onClick: (ids: string[]) => void;
    variant?: "default" | "danger";
  }>;
}

export function DataTable<T extends { id: string }>({ title, rows, columns, emptyText, bulkActions = [] }: DataTableProps<T>) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const allSelected = useMemo(
    () => rows.length > 0 && rows.every((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
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
    <section className="ui-surface overflow-hidden rounded-2xl shadow-[0_10px_28px_-22px_rgba(15,118,110,0.55)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{title}</h2>
        <span className="text-sm text-[var(--muted)]">共 {rows.length} 条</span>
      </header>

      {bulkActions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2.5">
          <span className="text-sm font-medium text-[var(--foreground)]">批量操作</span>
          <span className="text-xs text-[var(--muted)]">已选 {selectedIds.length} 项</span>
          {bulkActions.map((action) => (
            <button
              key={action.label}
              className={
                action.variant === "danger"
                  ? "ui-btn bg-rose-600 px-3 py-1 text-xs text-white hover:bg-rose-700"
                  : "ui-btn bg-[var(--brand)] px-3 py-1 text-xs text-white hover:bg-[var(--brand-strong)]"
              }
              disabled={selectedIds.length === 0}
              onClick={() => action.onClick(selectedIds)}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">{emptyText}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-[var(--surface-alt)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  <input checked={allSelected} onChange={toggleAll} type="checkbox" />
                </th>
                {columns.map((column) => (
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]" key={column.key}>
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => (
                <tr className="hover:bg-[var(--surface-alt)]/60" key={row.id}>
                  <td className="px-4 py-3">
                    <input checked={selectedIds.includes(row.id)} onChange={() => toggleOne(row.id)} type="checkbox" />
                  </td>
                  {columns.map((column) => (
                    <td className={`px-4 py-3 text-sm text-[var(--foreground)] ${column.className ?? ""}`} key={column.key}>
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
