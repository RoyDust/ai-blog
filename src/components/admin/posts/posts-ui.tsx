"use client";

/**
 * 后台文章列表的展示组件与纯函数助手。
 * 与数据层 hook（usePostsList）分离，便于页面壳组装与复用。
 */

import { useEffect, useState, type ReactNode } from "react";
import { Clock3, Loader2, CheckCircle2, Bot, Sparkles, XCircle, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import { Card, CardContent } from "@/components/shadcn/ui/card";
import { Input } from "@/components/shadcn/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/shadcn/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PostSummaryStatus } from "@/lib/post-summary-status";
import type { PaginationState, PostRow } from "./hooks/usePostsList";

export const placeholder = "-";

export type Tone = "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue";
type PageItem = number | "ellipsis-start" | "ellipsis-end";

export const toneClassName: Record<Tone, string> = {
  cyan: "border-[color-mix(in_oklab,var(--brand)_22%,var(--border))] bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]",
  emerald: "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-foreground)]",
  amber: "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-foreground)]",
  rose: "border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-foreground)]",
  slate: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-body)]",
  blue: "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)]",
};

export function fallbackText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : placeholder;
}

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN")
    : placeholder;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleDateString("zh-CN");
}

export function clampPage(value: number, totalPages: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(Math.max(Math.trunc(value), 1), Math.max(totalPages, 1));
}

export function getPaginationItems(currentPage: number, totalPages: number): PageItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, "ellipsis-start", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis-start", currentPage - 1, currentPage, currentPage + 1, "ellipsis-end", totalPages];
}

export function getSummaryMeta(status: PostSummaryStatus): { label: string; tone: Tone; icon: LucideIcon } {
  if (status === "QUEUED") return { label: "排队中", tone: "amber", icon: Clock3 };
  if (status === "GENERATING") return { label: "生成中", tone: "cyan", icon: Loader2 };
  if (status === "FAILED") return { label: "失败", tone: "rose", icon: XCircle };
  if (status === "GENERATED") return { label: "已生成", tone: "emerald", icon: Sparkles };
  return { label: "未生成", tone: "slate", icon: Bot };
}

export function getPreviewHref(row: PostRow) {
  const slug = row.slug?.trim();
  if (!slug) return null;
  return row.published ? `/posts/${slug}` : `/admin/posts/preview/${slug}`;
}

export function StatusPill({ tone, children, icon: Icon }: { tone: Tone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md px-2 font-medium", toneClassName[tone])}>
      {Icon ? <Icon className={cn("size-3", Icon === Loader2 && "animate-spin")} /> : null}
      {children}
    </Badge>
  );
}

export function PublishToggleTag({
  busy,
  onClick,
  published,
}: {
  busy: boolean;
  onClick: () => void;
  published: boolean;
}) {
  const Icon = busy ? Loader2 : published ? CheckCircle2 : Clock3;

  return (
    <Button
      aria-label={published ? "切换为草稿" : "切换为已发布"}
      className={cn(
        "h-7 gap-1 rounded-md border px-2 text-xs font-medium shadow-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
        toneClassName[published ? "emerald" : "amber"],
        published
          ? "hover:!border-[var(--success-border)] hover:!bg-[var(--success-surface)] hover:!text-[var(--success-foreground)]"
          : "hover:!border-[var(--warning-border)] hover:!bg-[var(--warning-surface)] hover:!text-[var(--warning-foreground)]",
      )}
      disabled={busy}
      onClick={onClick}
      size="xs"
      type="button"
      variant="outline"
    >
      <Icon className={cn("size-3.5", busy && "animate-spin")} />
      <span>{published ? "已发布" : "草稿"}</span>
      <span className="text-current/45">/</span>
      <span>{published ? "转草稿" : "发布"}</span>
    </Button>
  );
}

export function MetricCard({
  active,
  icon: Icon,
  label,
  value,
  tone,
  caption,
  onClick,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: Tone;
  caption: string;
  onClick?: () => void;
}) {
  const valueText = typeof value === "number" ? formatNumber(value) : value;

  return (
    <Card
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "rounded-lg border-[color-mix(in_oklab,var(--border)_80%,transparent)] bg-[var(--surface)] py-0 shadow-none transition-colors",
        onClick && "cursor-pointer hover:border-[var(--border-strong)] hover:bg-[var(--surface-alt)]",
        active && "border-[color-mix(in_oklab,var(--brand)_28%,var(--border))] bg-[color-mix(in_oklab,var(--brand)_8%,var(--surface))] ring-2 ring-[color-mix(in_oklab,var(--brand)_22%,transparent)]",
      )}
    >
      <CardContent className="flex items-center justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[var(--text-muted)]">{label}</p>
          <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[var(--foreground)]">{valueText}</p>
          <p className="mt-1 truncate text-xs text-[var(--text-muted)]">{caption}</p>
        </div>
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border", toneClassName[tone])}>
          <Icon className="size-4" />
        </span>
      </CardContent>
    </Card>
  );
}

export function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className={cn(
        "h-8 rounded-md px-3 text-xs",
        active
          ? "!border-[var(--foreground)] !bg-[var(--foreground)] !text-white hover:!bg-[var(--text-body)]"
          : "!border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]",
      )}
      onClick={onClick}
      type="button"
      variant={active ? "default" : "outline"}
    >
      {children}
    </Button>
  );
}

export function IconAction({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PaginationBar({
  disabled,
  onPageChange,
  onPageSizeChange,
  pagination,
}: {
  disabled?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pagination: PaginationState;
}) {
  const activePage = clampPage(pagination.page, pagination.totalPages);
  const pageItems = getPaginationItems(activePage, Math.max(pagination.totalPages, 1));
  const firstItem = pagination.total === 0 ? 0 : (activePage - 1) * pagination.limit + 1;
  const lastItem = Math.min(activePage * pagination.limit, pagination.total);
  const [jumpValue, setJumpValue] = useState(String(activePage));

  useEffect(() => {
    setJumpValue(String(activePage));
  }, [activePage]);

  const goToPage = (nextPage: number) => {
    const targetPage = clampPage(nextPage, pagination.totalPages);
    if (disabled || targetPage === activePage) return;
    onPageChange(targetPage);
  };

  return (
    <footer className="flex shrink-0 flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-alt)]/80 px-4 py-3 text-sm text-[var(--text-body)] xl:flex-row xl:items-center xl:justify-between">
      <p>
        显示第 {firstItem} 到 {lastItem} 条，共 {formatNumber(pagination.total)} 条记录
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <label className="flex items-center gap-2">
          每页
          <Select
            disabled={disabled}
            value={String(pagination.limit)}
            onValueChange={(value) => {
              const nextPageSize = Number(value);
              if (Number.isInteger(nextPageSize) && nextPageSize > 0 && nextPageSize !== pagination.limit) {
                onPageSizeChange(nextPageSize);
              }
            }}
          >
            <SelectTrigger className="h-8 w-[82px] rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
              {[10, 20, 50, 100].map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {pagination.totalPages > 1 ? (
          <Pagination className="mx-0 w-auto justify-start sm:justify-center" aria-label="分页">
            <PaginationContent>
              <PaginationItem>
                <Button
                  aria-label="上一页"
                  className="size-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]"
                  disabled={disabled || activePage <= 1}
                  onClick={() => goToPage(activePage - 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <span aria-hidden>‹</span>
                </Button>
              </PaginationItem>
              {pageItems.map((pageItem) => (
                <PaginationItem key={pageItem}>
                  {typeof pageItem === "number" ? (
                    <Button
                      aria-current={pageItem === activePage ? "page" : undefined}
                      aria-label={`第 ${pageItem} 页`}
                      className={cn(
                        "size-8 rounded-md !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]",
                        pageItem === activePage
                          ? "!bg-[var(--foreground)] !text-white hover:!bg-[var(--text-body)]"
                          : "!bg-[var(--surface)]",
                      )}
                      disabled={disabled || pageItem === activePage}
                      onClick={() => goToPage(pageItem)}
                      size="icon-sm"
                      type="button"
                      variant={pageItem === activePage ? "default" : "ghost"}
                    >
                      {pageItem}
                    </Button>
                  ) : (
                    <PaginationEllipsis />
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <Button
                  aria-label="下一页"
                  className="size-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]"
                  disabled={disabled || activePage >= pagination.totalPages}
                  onClick={() => goToPage(activePage + 1)}
                  size="icon-sm"
                  type="button"
                  variant="outline"
                >
                  <span aria-hidden>›</span>
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}

        {pagination.totalPages > 1 ? (
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              goToPage(Number(jumpValue));
            }}
          >
            跳至
            <Input
              aria-label="跳转页码"
              className="h-8 w-16 rounded-md !bg-[var(--surface)] px-2 text-center !text-[var(--foreground)]"
              disabled={disabled}
              inputMode="numeric"
              max={pagination.totalPages}
              min={1}
              onChange={(event) => setJumpValue(event.target.value)}
              type="number"
              value={jumpValue}
            />
            页
            <Button className="h-8 rounded-md !border-[var(--border)] !bg-[var(--surface)] !text-[var(--foreground)] hover:!bg-[var(--surface-alt)]" disabled={disabled} size="sm" type="submit" variant="outline">
              跳转
            </Button>
          </form>
        ) : null}
      </div>
    </footer>
  );
}
