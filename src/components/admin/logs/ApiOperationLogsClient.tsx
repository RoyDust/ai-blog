"use client";

import { useCallback, useState, type ReactNode } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  ListCheckboxToggle,
  ListSearchInput,
  LoadingStatus,
  MetricStrip,
  MotionTableRow,
  SkeletonTableRows,
  TableStateRow,
} from "@/components/admin/lists";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { Toolbar, ToolbarDivider } from "@/components/admin/primitives/Toolbar";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/admin/ui";
import { ConfirmDialog } from "@/components/admin/ui/confirm-dialog";
import { EmptyState } from "@/components/editorial";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { apiFetcher, apiMutate, toErrorMessage } from "@/lib/client-api";
import { cn } from "@/lib/cn";

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

const scopeOptions = ["", "admin", "public", "auth", "ai", "ai-usage", "cron", "analytics", "account"];
const allFilterValue = "__all__";
const defaultPageSize = 40;
const selectTriggerClassName = "w-full text-[0.8125rem] sm:w-[124px]";
const logColumnCount = 8;
const logSkeletonBars = ["w-24", "w-8", "w-10", "w-[70%]", "w-16", "w-12", "w-[80%]", "w-8"];

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

/** 状态码：等宽 700 语气色数字（2xx success、3xx muted、4xx warning、5xx danger），不再有彩色底 */
function statusToneClassName(statusCode: number | null) {
  if (statusCode === null) return "text-[var(--text-muted)]";
  if (statusCode >= 500) return "text-[var(--danger-foreground)]";
  if (statusCode >= 400) return "text-[var(--warning)]";
  if (statusCode >= 300) return "text-[var(--text-muted)]";
  return "text-[var(--success)]";
}

/** 路径后面同一行接的说明：operation · scope；没有 operation 时退回 scope · route */
function formatOperationLine(item: LogItem) {
  if (item.scope === "ai-usage") return `${item.operation ?? item.route ?? item.scope} · AI 用量`;
  if (item.operation) return `${item.operation} · ${item.scope}`;
  return item.route ? `${item.scope} · ${item.route}` : item.scope;
}

function DetailField({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-bold text-[var(--text-muted)]">{label}</p>
      <p className={cn("mt-1 text-[0.8125rem] break-all text-[var(--foreground)]", mono && "font-mono")}>{children}</p>
    </div>
  );
}

const jsonBlockClassName =
  "max-h-52 overflow-auto rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] px-3 py-2.5 font-mono text-xs leading-5 whitespace-pre-wrap break-all text-[var(--foreground)]";

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <p className={jsonBlockClassName}>无</p>;
  }

  return <pre className={jsonBlockClassName}>{JSON.stringify(value, null, 2)}</pre>;
}

function JsonSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-1.5 text-[0.8125rem] font-bold text-[var(--text-body)]">{title}</h3>
      {children}
    </section>
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
  const rangeLabel = rangeOptions.find((option) => option.value === range)?.label ?? `${range} 天`;
  const hasRows = !isLoading && !listError && payload.items.length > 0;

  const renderTableBody = () => {
    if (isLoading) {
      return <SkeletonTableRows bars={logSkeletonBars} rowHeightClassName="h-9" rows={8} />;
    }

    if (listError) {
      return (
        <TableStateRow colSpan={logColumnCount}>
          <EmptyState
            actions={
              <Button onClick={() => void mutate()} size="sm" type="button" variant="outline">
                重试
              </Button>
            }
            role="alert"
            title={errorMessage}
            tone="danger"
          />
        </TableStateRow>
      );
    }

    if (payload.items.length === 0) {
      return (
        <TableStateRow colSpan={logColumnCount}>
          <EmptyState description="调整筛选条件后重新查询，或等待新的接口请求产生日志。" role="status" title="暂无匹配日志" />
        </TableStateRow>
      );
    }

    return payload.items.map((item) => {
      const isServerError = (item.statusCode ?? 0) >= 500;
      return (
        <MotionTableRow key={item.id}>
          <TableCell className="h-9 py-0 font-mono text-xs text-[var(--text-body)] tabular-nums">{formatDate(item.createdAt)}</TableCell>
          <TableCell className={cn("h-9 py-0 font-mono text-[0.8125rem] font-bold tabular-nums", statusToneClassName(item.statusCode))}>
            {item.statusCode ?? "NA"}
          </TableCell>
          <TableCell className="h-9 py-0 font-mono text-xs font-bold text-[var(--foreground)]">{item.method}</TableCell>
          <TableCell className="h-9 overflow-hidden py-0">
            <span className="flex min-w-0 items-baseline gap-2">
              <span className="shrink-0 truncate font-mono text-[0.8125rem] text-[var(--foreground)]" title={item.path}>
                {item.path}
              </span>
              <span className="min-w-0 truncate font-mono text-[0.6875rem] text-[var(--text-muted)]">{formatOperationLine(item)}</span>
            </span>
          </TableCell>
          <TableCell className={cn("h-9 truncate py-0 text-[0.8125rem]", formatActor(item) === "unknown" ? "text-[var(--text-muted)]" : "text-[var(--text-body)]")}>
            {formatActor(item)}
          </TableCell>
          <TableCell
            className={cn(
              "h-9 py-0 text-right font-mono text-xs tabular-nums",
              isServerError ? "text-[var(--danger-foreground)]" : "text-[var(--text-body)]",
            )}
          >
            {item.durationMs ?? 0} ms
          </TableCell>
          <TableCell className="h-9 truncate py-0 font-mono text-[0.6875rem] text-[var(--text-muted)]" title={item.requestId}>
            {item.requestId}
          </TableCell>
          <TableCell className="h-9 py-0">
            <button aria-label="查看接口日志详情" className={cn(adminTextActionClassName, "min-h-7")} onClick={() => setSelectedLog(item)} type="button">
              详情
            </button>
          </TableCell>
        </MotionTableRow>
      );
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MetricStrip
        ariaLabel="接口请求概况"
        className="mt-1 shrink-0"
        items={[
          { key: "total", label: "总请求", value: payload.summary.totalCount.toLocaleString("zh-CN"), note: `近 ${rangeLabel}` },
          { key: "success", label: "成功", value: payload.summary.successCount.toLocaleString("zh-CN"), note: "2xx / 3xx", tone: "success" },
          {
            key: "failed",
            label: "失败",
            value: payload.summary.failedCount.toLocaleString("zh-CN"),
            note: "4xx / 5xx",
            tone: payload.summary.failedCount > 0 ? "danger" : "default",
          },
        ]}
      />

      <AdminSectionHeader
        aside={
          <span className="ed-mono">
            第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页
          </span>
        }
        className="mt-6 shrink-0"
        description={`${payload.summary.totalCount.toLocaleString("zh-CN")} 条匹配记录`}
        title="请求记录"
      />

      <Toolbar
        className="shrink-0"
        leading={
          <>
            <Select
              value={range}
              onValueChange={(value) => {
                setRange(value);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="时间范围" className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rangeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterValue(method)}
              onValueChange={(value) => {
                setMethod(normalizeFilterValue(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="请求方法" className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {methodOptions.map((option) => (
                  <SelectItem key={option || allFilterValue} value={option || allFilterValue}>
                    {option || "全部方法"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterValue(status)}
              onValueChange={(value) => {
                setStatus(normalizeFilterValue(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="状态码" className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value || allFilterValue} value={option.value || allFilterValue}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterValue(scope)}
              onValueChange={(value) => {
                setScope(normalizeFilterValue(value));
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="请求范围" className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scopeOptions.map((option) => (
                  <SelectItem key={option || allFilterValue} value={option || allFilterValue}>
                    {option || "全部范围"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ListSearchInput
              ariaLabel="搜索接口日志"
              className="min-w-[14rem] flex-1 sm:w-auto"
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="搜索 path / operation / requestId"
              value={query}
            />
            <ListCheckboxToggle
              checked={includeSelf}
              label="显示自身"
              onChange={(checked) => {
                setIncludeSelf(checked);
                setPage(1);
              }}
            />
            <ToolbarDivider />
            <Button aria-label="刷新接口日志" disabled={isValidating} onClick={() => void mutate()} size="icon" title="刷新" type="button" variant="outline">
              <RefreshCw aria-hidden="true" className={cn("size-4", isValidating && "animate-spin motion-reduce:animate-none")} />
            </Button>
            <Button aria-label="清理旧日志" disabled={purging} onClick={() => setPurgeDialogOpen(true)} size="icon" title="清理旧日志" type="button" variant="outline">
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </>
        }
      />

      <div aria-busy={isLoading || undefined} className="min-h-0 flex-1 overflow-auto" data-testid="admin-logs-table-scroll">
        {isLoading ? <LoadingStatus label="正在加载接口日志..." /> : null}
        <table className="w-full min-w-[980px] table-fixed caption-bottom text-sm" data-slot="table">
          <TableHeader className="sticky top-0 z-10 bg-[var(--card-bg)]">
            <TableRow>
              <TableHead className="w-[132px]">时间</TableHead>
              <TableHead className="w-[64px]">状态</TableHead>
              <TableHead className="w-[76px]">方法</TableHead>
              <TableHead>路径</TableHead>
              <TableHead className="w-[150px]">调用方</TableHead>
              <TableHead className="w-[88px] text-right">耗时</TableHead>
              <TableHead className="w-[176px]">Request ID</TableHead>
              <TableHead className="w-[56px]">详情</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderTableBody()}</TableBody>
        </table>
      </div>

      {hasRows && pagination.total > 0 ? (
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

      <Dialog open={Boolean(selectedLog)} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[56rem] gap-0 overflow-y-auto p-0 sm:max-w-[56rem]">
          <DialogHeader className="px-6 pt-5 pb-4">
            <DialogTitle className="text-[1.375rem]">接口日志详情</DialogTitle>
            <DialogDescription className="font-mono text-[0.875rem] text-[var(--foreground)]">
              {detailLog ? `${detailLog.method} ${detailLog.path}` : ""}
            </DialogDescription>
          </DialogHeader>
          {detailLog ? (
            <div className="space-y-4 px-6 pb-5">
              {detailLoading ? <p className="text-[0.8125rem] text-[var(--text-muted)]">正在加载详情...</p> : null}
              {detailError ? (
                <p className="text-[0.8125rem] text-[var(--danger-foreground)]" role="alert">
                  {toErrorMessage(detailError, "接口日志详情加载失败")}
                </p>
              ) : null}
              <div className="grid gap-4 border-y border-[var(--border)] py-3.5 md:grid-cols-3">
                <DetailField label="Request ID" mono>
                  {detailLog.requestId}
                </DetailField>
                <DetailField label="Operation">
                  {detailLog.operation ?? "未标记"}
                  {detailLog.scope === "ai-usage" ? " · AI 用量" : ""}
                </DetailField>
                <DetailField label="Actor" mono>
                  {formatActor(detailLog)}
                </DetailField>
              </div>
              {detailLog.errorMessage ? (
                <div className="border-l-2 border-[var(--danger-foreground)] pl-3 text-[0.8125rem] leading-6 text-[var(--danger-foreground)]" role="note">
                  <p className="font-mono font-bold">{detailLog.errorName ?? "Error"}</p>
                  <p>{detailLog.errorMessage}</p>
                </div>
              ) : null}
              <div className="grid gap-x-6 gap-y-4 lg:grid-cols-2">
                <JsonSection title="Query">
                  <JsonBlock value={detailLog.query} />
                </JsonSection>
                <JsonSection title="Request Body">
                  <JsonBlock value={detailLog.requestBody} />
                </JsonSection>
                <JsonSection title="Metadata">
                  <JsonBlock value={detailLog.metadata} />
                </JsonSection>
                <JsonSection title="User Agent">
                  <p className={jsonBlockClassName}>{detailLog.userAgent ?? "无"}</p>
                </JsonSection>
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-t border-[var(--border)] px-6 py-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                关闭
              </Button>
            </DialogClose>
          </DialogFooter>
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
