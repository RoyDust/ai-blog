"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import type { DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { apiFetcher, apiMutate, ApiRequestError, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

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

type TaxonomyResponse<Row> = {
  success?: boolean;
  data?: Row[];
  pagination?: PaginationState;
};

/**
 * Shared list lifecycle for category/tag managers.
 *
 * SWR 内核：列表请求由 key（URL）驱动，本地筛选与删除预览/确认走 apiMutate；
 * `setRows` 保留函数式更新 API，作为对 SWR 缓存的乐观写入（revalidate: false）。
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
  const [query, setQueryValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPagination.limit);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  // 服务端分页模式下输入防抖（setState 在定时器回调中）
  const debounceTimerRef = useRef<number | null>(null);
  const setQuery = useCallback(
    (value: string) => {
      setQueryValue(value);
      if (serverPagination) {
        setPage(1);
        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          setDebouncedQuery(value);
        }, 300);
      }
    },
    [serverPagination],
  );

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const listUrl = useMemo(() => {
    if (!serverPagination) return endpoint;

    const params = new URLSearchParams({
      page: String(page),
      limit: String(pageSize),
    });
    const keyword = debouncedQuery.trim();
    if (keyword) params.set("q", keyword);
    return `${endpoint}?${params.toString()}`;
  }, [debouncedQuery, endpoint, page, pageSize, serverPagination]);

  const {
    data: rowsResponse,
    isLoading,
    mutate,
  } = useSWR<TaxonomyResponse<Row>>(listUrl, apiFetcher, {
    keepPreviousData: true,
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key);
      toast.error(swrError instanceof ApiRequestError ? toErrorMessage(swrError, listError) : listRetryError);
    },
  });

  const rows = useMemo(() => (Array.isArray(rowsResponse?.data) ? rowsResponse.data : []), [rowsResponse]);
  const pagination = useMemo(
    () =>
      rowsResponse?.pagination ?? {
        ...defaultPagination,
        limit: pageSize,
        total: rows.length,
        totalPages: Math.max(1, Math.ceil(rows.length / pageSize)),
      },
    [pageSize, rows.length, rowsResponse],
  );
  const loading = isLoading;

  // 服务端校正页码时同步回状态（渲染期条件调整）
  if (rowsResponse?.pagination && rowsResponse.pagination.page !== page) {
    setPage(rowsResponse.pagination.page);
  }

  const filtered = useMemo(() => {
    if (serverPagination) return rows;
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => filterRow(row, keyword));
  }, [filterRow, query, rows, serverPagination]);

  // 兼容函数式更新：作为对 SWR 缓存的乐观写入（不改远端，revalidate: false）
  const setRows = useCallback(
    (updater: SetStateAction<Row[]>) => {
      void mutate(
        (current) => {
          const currentRows = Array.isArray(current?.data) ? current.data : [];
          const nextRows = typeof updater === "function" ? (updater as (prev: Row[]) => Row[])(currentRows) : updater;
          return { ...(current ?? { success: true }), data: nextRows };
        },
        { revalidate: false },
      );
    },
    [mutate],
  );

  const openDeleteDialog = useCallback(
    async (ids: string[]) => {
      try {
        const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
        const data = await apiMutate<{ success?: boolean; data?: DeleteDialogState }>(`${endpoint}?${params.toString()}`);

        if (!data.success || !data.data) {
          toast.error(toErrorMessage(data, previewError));
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
      await apiMutate(`${endpoint}?${params.toString()}`, { method: "DELETE" });

      if (serverPagination) {
        void mutate();
      } else {
        void mutate(
          (current) => {
            const currentRows = Array.isArray(current?.data) ? current.data : [];
            return { ...(current ?? { success: true }), data: currentRows.filter((item) => !ids.includes(item.id)) };
          },
          { revalidate: false },
        );
      }
      setDeleteDialog(initialDeleteDialog);
      toast.success(deleteSuccess(ids.length));
    } catch (error) {
      toast.error(error instanceof ApiRequestError ? toErrorMessage(error, deleteError) : deleteRetryError);
      setDeleteDialog((prev) => ({ ...prev, submitting: false }));
    }
  }, [deleteDialog.ids, deleteError, deleteRetryError, deleteSuccess, endpoint, mutate, serverPagination]);

  return {
    closeDeleteDialog,
    confirmDelete,
    deleteDialog,
    filtered,
    loading,
    openDeleteDialog,
    pagination,
    query,
    reload: () => {
      void mutate();
    },
    rows,
    setPage,
    setPageSize,
    setQuery,
    setRows,
  };
}
