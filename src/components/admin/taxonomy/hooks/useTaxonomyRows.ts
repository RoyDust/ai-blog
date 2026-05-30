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

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const initialDeleteDialog: DeleteDialogState = {
  open: false,
  ids: [],
  title: "",
  description: "",
  impacts: [],
  submitting: false,
};

const defaultPagination: PaginationState = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
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
  serverPagination?: boolean;
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
  serverPagination = false,
}: UseTaxonomyRowsOptions<Row>) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQueryValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPagination.limit);
  const [pagination, setPagination] = useState<PaginationState>(defaultPagination);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (serverPagination) {
        params.set("page", String(page));
        params.set("limit", String(pageSize));
        const keyword = debouncedQuery.trim();
        if (keyword) params.set("q", keyword);
      }

      const url = serverPagination ? `${endpoint}?${params.toString()}` : endpoint;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        if (serverPagination) {
          const nextPagination = data.pagination ?? {
            page,
            limit: pageSize,
            total: data.data.length,
            totalPages: Math.max(1, Math.ceil(data.data.length / pageSize)),
          };
          setPagination(nextPagination);
          if (nextPagination.page !== page) {
            setPage(nextPagination.page);
          }
        }
        return;
      }

      toast.error(getApiErrorMessage(data, listError));
      setRows([]);
      if (serverPagination) {
        setPagination({ ...defaultPagination, limit: pageSize });
      }
    } catch {
      toast.error(listRetryError);
      setRows([]);
      if (serverPagination) {
        setPagination({ ...defaultPagination, limit: pageSize });
      }
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, endpoint, listError, listRetryError, page, pageSize, serverPagination]);

  useEffect(() => {
    if (!serverPagination) return;
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query, serverPagination]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (serverPagination) return rows;
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => filterRow(row, keyword));
  }, [filterRow, query, rows, serverPagination]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryValue(value);
      if (serverPagination) {
        setPage(1);
      }
    },
    [serverPagination],
  );

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
        if (serverPagination) {
          void load();
        } else {
          setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
        }
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteSuccess(ids.length));
        return;
      }

      toast.error(getApiErrorMessage(data, deleteError));
    } catch {
      toast.error(deleteRetryError);
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }, [deleteDialog.ids, deleteError, deleteRetryError, deleteSuccess, endpoint, load, serverPagination]);

  return {
    closeDeleteDialog,
    confirmDelete,
    deleteDialog,
    filtered,
    loading,
    openDeleteDialog,
    pagination,
    query,
    reload: load,
    rows,
    setPage,
    setPageSize,
    setQuery,
    setRows,
  };
}
