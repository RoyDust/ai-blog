"use client";

import { useCallback, useState } from "react";
import { CheckCircle2, Eye, RefreshCw, Search, SearchX, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { Button } from "@/components/shadcn/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/shadcn/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";

type LogItem = {
  id: string;
  requestId: string;
  method: string;
  path: string;
  route: string | null;
  scope: string;
  operation: string | null;
  statusCode: number | null;
  success: boolean;
  durationMs: number | null;
  actorType: string | null;
  actorUserId: string | null;
  actorClientId: string | null;
  actorLabel: string | null;
  ipHash: string | null;
  userAgent: string | null;
  query: unknown;
  requestBody: unknown;
  errorName: string | null;
  errorMessage: string | null;
  metadata: unknown;
  createdAt: string;
};

type LogPayload = {
  items: LogItem[];
  nextCursor: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalCount: number;
    failedCount: number;
    successCount: number;
  };
};

type LogsResponse = { success?: boolean; data?: LogPayload };

const rangeOptions = [
  { value: "1", label: "24 小时" },
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
];

const methodOptions = ["", "GET", "POST", "PATCH", "DELETE"];
const statusOptions = [
  { value: "", label: "全部状态" },
  { value: "2xx", label: "2xx" },
  { value: "3xx", label: "3xx" },
  { value: "4xx", label: "4xx" },
  { value: "5xx", label: "5xx" },
];

const scopeOptions = ["", "admin", "public", "auth", "ai", "cron", "analytics", "account"];
const allFilterValue = "__all__";
const defaultPageSize = 40;
const selectTriggerClassName = "h-10 w-full rounded-xl border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-medium text-[var(--foreground)] shadow-none";

const EMPTY_PAYLOAD: LogPayload = {
  items: [],
  nextCursor: null,
  pagination: { page: 1, limit: defaultPageSize, total: 0, totalPages: 1 },
  summary: { totalCount: 0, failedCount: 0, successCount: 0 },
};

function filterValue(value: string) {
  return value || allFilterValue;
}

function normalizeFilterValue(value: string) {
  return value === allFilterValue ? "" : value;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatActor(item: LogItem) {
  if (item.actorLabel) return item.actorLabel;
  if (item.actorClientId) return item.actorClientId;
  if (item.actorUserId) return item.actorUserId;
  return item.actorType ?? "unknown";
}

function statusClassName(success: boolean) {
  return success ? "bg-[var(--success-surface)] text-[var(--success-foreground)]" : "bg-[var(--danger-surface)] text-[var(--danger-foreground)]";
}

function methodClassName(method: string) {
  if (method === "GET") return "bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]";
  if (method === "POST") return "bg-[var(--success-surface)] text-[var(--success-foreground)]";
  if (method === "PATCH") return "bg-[var(--warning-surface)] text-[var(--warning-foreground)]";
  if (method === "DELETE") return "bg-[var(--danger-surface)] text-[var(--danger-foreground)]";
  return "bg-[var(--surface-alt)] text-[var(--muted)]";
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className="text-sm text-[var(--muted)]">无</p>;
  }

  return (
    <pre className="max-h-52 overflow-auto rounded-xl bg-[var(--surface-alt)] p-3 text-xs leading-5 text-[var(--foreground)]">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function ApiOperationLogsClient() {
  const [range, setRange] = useState("7");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState("");
  const [scope, setScope] = useState("");
  const [query, setQuery] = useState("");
  const [includeSelf, setIncludeSelf] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [selectedLog, setSelectedLog] = useState<LogItem | null>(null);
  const [purging, setPurging] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);

  const buildLogsUrl = useCallback((pageNumber: number) => {
    const params = new URLSearchParams({ range, limit: String(pageSize), page: String(pageNumber) });
    if (method) params.set("method", method);
    if (status) params.set("status", status);
    if (scope) params.set("scope", scope);
    if (query.trim()) params.set("path", query.trim());
    if (includeSelf) params.set("includeSelf", "1");
    return `/api/admin/logs?${params.toString()}`;
  }, [includeSelf, method, pageSize, query, range, scope, status]);

  // 列表数据：URL 即 SWR key，筛选/翻页自动重取；keepPreviousData 保证切换时不闪空
  const {
    data: logsResponse,
    error: listError,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<LogsResponse>(buildLogsUrl(page), apiFetcher, { keepPreviousData: true });

  const payload = logsResponse?.data ?? EMPTY_PAYLOAD;
  const errorMessage = toErrorMessage(listError, "接口日志加载失败");

  // 详情：选中条目时才请求（条件 key）
  const {
    data: detailResponse,
    error: detailError,
    isLoading: detailLoading,
  } = useSWR<{ success?: boolean; data?: LogItem }>(
    selectedLog ? `/api/admin/logs/${selectedLog.id}` : null,
    apiFetcher,
  );
  const detailLog = detailResponse?.data ?? selectedLog;

  const purgeOldLogs = useCallback(async () => {
    setPurging(true);
    try {
      await apiMutate("/api/admin/logs/purge", {
        method: "POST",
        body: JSON.stringify({ retentionDays: 30 }),
      });
      await mutate();
      toast.success("已清理 30 天前的操作日志");
      setPurgeDialogOpen(false);
    } catch (purgeError) {
      toast.error(toErrorMessage(purgeError, "清理操作日志失败"));
    } finally {
      setPurging(false);
    }
  }, [mutate]);

  const pagination = payload.pagination;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <section className="grid shrink-0 gap-3 md:grid-cols-3">
        <div className="ui-surface rounded-2xl px-4 py-3">
          <p className="text-xs font-medium uppercase text-[var(--muted)]">总请求</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{payload.summary.totalCount}</p>
        </div>
        <div className="ui-surface rounded-2xl px-4 py-3">
          <p className="text-xs font-medium uppercase text-[var(--muted)]">成功</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--success-foreground)]">{payload.summary.successCount}</p>
        </div>
        <div className="ui-surface rounded-2xl px-4 py-3">
          <p className="text-xs font-medium uppercase text-[var(--muted)]">失败</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--danger-foreground)]">{payload.summary.failedCount}</p>
        </div>
      </section>

      <section className="ui-surface shrink-0 rounded-2xl p-3">
        <div className="grid gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(240px,1.4fr)_auto]">
          <Select value={range} onValueChange={(value) => {
            setRange(value);
            setPage(1);
          }}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
              {rangeOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterValue(method)} onValueChange={(value) => {
            setMethod(normalizeFilterValue(value));
            setPage(1);
          }}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
              {methodOptions.map((option) => (
                <SelectItem key={option || allFilterValue} value={option || allFilterValue}>
                  {option || "全部方法"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterValue(status)} onValueChange={(value) => {
            setStatus(normalizeFilterValue(value));
            setPage(1);
          }}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
              {statusOptions.map((option) => (
                <SelectItem key={option.value || allFilterValue} value={option.value || allFilterValue}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterValue(scope)} onValueChange={(value) => {
            setScope(normalizeFilterValue(value));
            setPage(1);
          }}>
            <SelectTrigger className={selectTriggerClassName}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
              {scopeOptions.map((option) => (
                <SelectItem key={option || allFilterValue} value={option || allFilterValue}>
                  {option || "全部范围"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm"
              placeholder="搜索 path / operation / requestId"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)]">
              <input checked={includeSelf} onChange={(event) => {
                setIncludeSelf(event.target.checked);
                setPage(1);
              }} type="checkbox" />
              显示自身
            </label>
            <Button aria-label="刷新接口日志" disabled={isValidating} onClick={() => void mutate()} size="icon" type="button" variant="outline">
              <RefreshCw className={`h-4 w-4 ${isValidating ? "animate-spin" : ""}`} />
            </Button>
            <Button aria-label="清理旧日志" disabled={purging} onClick={() => setPurgeDialogOpen(true)} size="icon" type="button" variant="outline">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <div className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="text-base font-semibold text-[var(--foreground)]">请求记录</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{payload.summary.totalCount} 条匹配记录</p>
          </div>
        </div>

        {isLoading ? <p className="px-5 py-10 text-center text-sm text-[var(--text-muted)]">正在加载接口日志...</p> : null}
        {!isLoading && listError ? <p className="px-5 py-10 text-center text-sm text-rose-600">{errorMessage}</p> : null}
        {!isLoading && !listError && payload.items.length === 0 ? (
          <Empty className="border-0" role="status">
            <EmptyMedia variant="icon">
              <SearchX className="size-5" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>暂无匹配日志</EmptyTitle>
              <EmptyDescription>调整筛选条件后重新查询，或等待新的接口请求产生日志。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {!isLoading && !listError && payload.items.length > 0 ? (
          <>
            <div className="min-h-0 flex-1 overflow-auto">
              <Table className="min-w-[980px] table-fixed">
                <TableHeader className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface-alt)] shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableHead className="w-[120px] text-xs uppercase tracking-wide text-[var(--text-muted)]">时间</TableHead>
                    <TableHead className="w-[96px] text-xs uppercase tracking-wide text-[var(--text-muted)]">状态</TableHead>
                    <TableHead className="w-[90px] text-xs uppercase tracking-wide text-[var(--text-muted)]">方法</TableHead>
                    <TableHead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">路径</TableHead>
                    <TableHead className="w-[170px] text-xs uppercase tracking-wide text-[var(--text-muted)]">调用方</TableHead>
                    <TableHead className="w-[90px] text-xs uppercase tracking-wide text-[var(--text-muted)]">耗时</TableHead>
                    <TableHead className="w-[190px] text-xs uppercase tracking-wide text-[var(--text-muted)]">Request ID</TableHead>
                    <TableHead className="w-[76px] text-xs uppercase tracking-wide text-[var(--text-muted)]">详情</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payload.items.map((item) => (
                    <TableRow key={item.id} className="border-[var(--border)] transition-colors hover:bg-[var(--surface-alt)]/80">
                      <TableCell className="whitespace-nowrap align-top text-xs text-[var(--text-muted)]">{formatDate(item.createdAt)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName(item.success)}`}>
                          {item.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {item.statusCode ?? "NA"}
                        </span>
                      </TableCell>
                      <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${methodClassName(item.method)}`}>{item.method}</span></TableCell>
                      <TableCell className="whitespace-normal align-top">
                        <p className="truncate font-medium text-[var(--foreground)]">{item.path}</p>
                        <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{item.operation ?? item.route ?? item.scope}</p>
                      </TableCell>
                      <TableCell className="truncate align-top text-[var(--text-body)]">{formatActor(item)}</TableCell>
                      <TableCell className="whitespace-nowrap align-top text-[var(--text-body)]">{item.durationMs ?? 0} ms</TableCell>
                      <TableCell className="truncate align-top text-xs text-[var(--text-muted)]">{item.requestId}</TableCell>
                      <TableCell>
                        <Button aria-label="查看接口日志详情" className="size-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--text-body)] hover:!bg-[var(--surface-alt)]" onClick={() => void setSelectedLog(item)} size="icon-sm" type="button" variant="outline">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {pagination.total > 0 ? (
              <AdminPagination
                className="shrink-0"
                disabled={isValidating}
                itemLabel="条记录"
                onPageChange={setPage}
                onPageSizeChange={(nextPageSize) => {
                  setPageSize(nextPageSize);
                  setPage(1);
                }}
                page={pagination.page}
                pageSize={pagination.limit}
                pageSizeOptions={[20, 40, 80, 100]}
                total={pagination.total}
                totalPages={pagination.totalPages}
              />
            ) : null}
          </>
        ) : null}
      </section>

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>接口日志详情</DialogTitle>
            <DialogDescription>{detailLog ? `${detailLog.method} ${detailLog.path}` : ""}</DialogDescription>
          </DialogHeader>
          {detailLog ? (
            <div className="max-h-[70dvh] space-y-4 overflow-y-auto px-6 py-5">
              {detailLoading ? <p className="text-sm text-[var(--muted)]">正在加载详情...</p> : null}
              {detailError ? <p className="text-sm text-rose-600">{toErrorMessage(detailError, "接口日志详情加载失败")}</p> : null}
              <div className="grid gap-3 md:grid-cols-3">
                <div><p className="text-xs text-[var(--muted)]">Request ID</p><p className="mt-1 break-all text-sm">{detailLog.requestId}</p></div>
                <div><p className="text-xs text-[var(--muted)]">Operation</p><p className="mt-1 text-sm">{detailLog.operation ?? "未标记"}</p></div>
                <div><p className="text-xs text-[var(--muted)]">Actor</p><p className="mt-1 text-sm">{formatActor(detailLog)}</p></div>
              </div>
              {detailLog.errorMessage ? (
                <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
                  <p className="font-medium">{detailLog.errorName ?? "Error"}</p>
                  <p className="mt-1">{detailLog.errorMessage}</p>
                </div>
              ) : null}
              <div className="grid gap-4 lg:grid-cols-2">
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Query</h3>
                  <JsonBlock value={detailLog.query} />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Request Body</h3>
                  <JsonBlock value={detailLog.requestBody} />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">Metadata</h3>
                  <JsonBlock value={detailLog.metadata} />
                </section>
                <section>
                  <h3 className="mb-2 text-sm font-semibold">User Agent</h3>
                  <p className="rounded-xl bg-[var(--surface-alt)] p-3 text-xs leading-5 text-[var(--foreground)]">{detailLog.userAgent ?? "无"}</p>
                </section>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        cancelLabel="取消"
        confirmLabel="确认清理"
        description="将删除 30 天前的操作日志记录，删除后不可恢复。"
        onConfirm={() => void purgeOldLogs()}
        onOpenChange={setPurgeDialogOpen}
        open={purgeDialogOpen}
        submitting={purging}
        title="清理旧日志"
        tone="danger"
      />
    </div>
  );
}
