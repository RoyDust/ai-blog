"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import type { DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { getApiErrorMessage } from "@/lib/admin-api-client";

type DeleteDialogState = {
  open: boolean;
  ids: string[];
  title: string;
  description: string;
  impacts: DeleteImpactItem[];
  submitting: boolean;
};

const initialDeleteDialog: DeleteDialogState = {
  open: false,
  ids: [],
  title: "",
  description: "",
  impacts: [],
  submitting: false,
};

type UseTaxonomyRowsOptions<Row extends { id: string }> = {
  deleteError: string;
  deleteRetryError: string;
  deleteSuccess: (count: number) => string;
  endpoint: string;
  filterRow: (row: Row, keyword: string) => boolean;
  listError: string;
  listRetryError: string;
  previewError: string;
  previewRetryError: string;
};

/**
 * Shared list lifecycle for category/tag managers.
 * Handles loading, local filtering, delete preview, and optimistic row removal after delete.
 */
export function useTaxonomyRows<Row extends { id: string }>({
  deleteError,
  deleteRetryError,
  deleteSuccess,
  endpoint,
  filterRow,
  listError,
  listRetryError,
  previewError,
  previewRetryError,
}: UseTaxonomyRowsOptions<Row>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        return;
      }

      toast.error(getApiErrorMessage(data, listError));
      setRows([]);
    } catch {
      toast.error(listRetryError);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, listError, listRetryError]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => filterRow(row, keyword));
  }, [filterRow, query, rows]);

  const openDeleteDialog = useCallback(
    async (ids: string[]) => {
      try {
        const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
        const res = await fetch(`${endpoint}?${params.toString()}`);
        const data = await res.json();
        if (!data.success) {
          toast.error(getApiErrorMessage(data, previewError));
          return;
        }

        setDeleteDialog({
          open: true,
          ids,
          title: data.data.title,
          description: data.data.description,
          impacts: data.data.impacts,
          submitting: false,
        });
      } catch {
        toast.error(previewRetryError);
      }
    },
    [endpoint, previewError, previewRetryError],
  );

  const closeDeleteDialog = useCallback(() => setDeleteDialog(initialDeleteDialog), []);

  const confirmDelete = useCallback(async () => {
    try {
      setDeleteDialog((prev) => ({ ...prev, submitting: true }));
      const ids = deleteDialog.ids;
      const params = new URLSearchParams({ ids: ids.join(",") });
      const res = await fetch(`${endpoint}?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteSuccess(ids.length));
        return;
      }

      toast.error(getApiErrorMessage(data, deleteError));
    } catch {
      toast.error(deleteRetryError);
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }, [deleteDialog.ids, deleteError, deleteRetryError, deleteSuccess, endpoint]);

  return {
    closeDeleteDialog,
    confirmDelete,
    deleteDialog,
    filtered,
    loading,
    openDeleteDialog,
    query,
    rows,
    setQuery,
    setRows,
  };
}
