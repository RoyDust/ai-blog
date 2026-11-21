"use client";

import { type FormEvent, useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { ActiveUnderline } from "@/components/editorial";
import { Button } from "@/components/admin/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/ui/select";
import { cn } from "@/lib/utils";

type PageItem = number | "ellipsis-start" | "ellipsis-end";

export type AdminPaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  className?: string;
  disabled?: boolean;
  itemLabel?: string;
  pageSizeOptions?: number[];
  hrefBase?: string;
  hrefParams?: Record<string, string | null | undefined>;
  pageParamName?: string;
  pageSizeParamName?: string;
  getPageHref?: (page: number) => string;
  getPageSizeHref?: (pageSize: number) => string;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function getAdminPaginationItems(currentPage: number, totalPages: number): PageItem[] {
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

function clampPage(value: number, totalPages: number) {
  if (!Number.isFinite(value)) return 1;

  return Math.min(Math.max(Math.trunc(value), 1), Math.max(totalPages, 1));
}

export function AdminPagination({
  page,
  pageSize,
  total,
  totalPages,
  className,
  disabled = false,
  itemLabel = "条记录",
  pageSizeOptions = [10, 20, 50, 100],
  hrefBase,
  hrefParams = {},
  pageParamName = "page",
  pageSizeParamName = "limit",
  getPageHref,
  getPageSizeHref,
  onPageChange,
  onPageSizeChange,
}: AdminPaginationProps) {
  const activePage = clampPage(page, totalPages);
  const pageItems = getAdminPaginationItems(activePage, Math.max(totalPages, 1));
  const firstItem = total === 0 ? 0 : (activePage - 1) * pageSize + 1;
  const lastItem = Math.min(activePage * pageSize, total);
  const canPaginate = totalPages > 1;
  const canChoosePageSize = pageSizeOptions.length > 1;
  const [jumpValue, setJumpValue] = useState(String(activePage));
  const underlineId = useId();
  // 渲染期条件调整（AGENTS.md 允许的模式）：外部页码变化时同步跳转输入框，不在 effect 内 setState；
  // 用 state 记忆上次页码而非 ref（react-hooks/refs 禁止渲染期访问 ref）
  const [lastActivePage, setLastActivePage] = useState(activePage);
  if (lastActivePage !== activePage) {
    setLastActivePage(activePage);
    setJumpValue(String(activePage));
  }

  const buildHref = (targetPage: number, nextPageSize = pageSize) => {
    if (!hrefBase) return null;

    const params = new URLSearchParams();
    if (targetPage > 1) params.set(pageParamName, String(targetPage));
    Object.entries(hrefParams).forEach(([key, value]) => {
      if (!value || key === pageParamName || key === pageSizeParamName) return;
      params.set(key, value);
    });
    params.set(pageSizeParamName, String(nextPageSize));

    const query = params.toString();
    return query ? `${hrefBase}?${query}` : hrefBase;
  };

  const resolvePageHref = (targetPage: number) => getPageHref?.(targetPage) ?? buildHref(targetPage);
  const resolvePageSizeHref = (nextPageSize: number) => getPageSizeHref?.(nextPageSize) ?? buildHref(1, nextPageSize);

  if (total === 0 && !canChoosePageSize) {
    return null;
  }

  const goToPage = (nextPage: number) => {
    const targetPage = clampPage(nextPage, totalPages);
    if (disabled || targetPage === activePage) return;

    const href = resolvePageHref(targetPage);
    if (href) {
      window.location.assign(href);
      return;
    }

    onPageChange?.(targetPage);
  };

  const handleJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    goToPage(Number(jumpValue));
  };

  const handlePageSizeChange = (value: string) => {
    const nextPageSize = Number(value);
    if (!Number.isInteger(nextPageSize) || nextPageSize <= 0 || nextPageSize === pageSize || disabled) return;

    const href = resolvePageSizeHref(nextPageSize);
    if (href) {
      window.location.assign(href);
      return;
    }

    onPageSizeChange?.(nextPageSize);
  };

  // 页码：等宽字，当前页 foreground 700 + 2px sky 下划线（同一实例内 layoutId 平移）
  const pageNumberClassName =
    "relative inline-flex h-8 min-w-8 items-center justify-center rounded-[var(--radius-ctl)] px-1.5 font-mono text-[0.8125rem] tabular-nums transition-colors duration-150";
  const idlePageClassName = "text-[var(--text-muted)] hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)]";
  const activePageClassName = "rounded-none font-bold text-[var(--foreground)]";

  const renderPageButton = (pageNumber: number) => {
    const isActive = pageNumber === activePage;
    const label = `第 ${pageNumber} 页`;
    const underline = isActive ? <ActiveUnderline layoutId={`admin-pagination-${underlineId}`} /> : null;

    const href = resolvePageHref(pageNumber);
    if (href) {
      return (
        <a
          aria-current={isActive ? "page" : undefined}
          aria-label={label}
          className={cn(pageNumberClassName, isActive ? activePageClassName : idlePageClassName)}
          href={href}
          onClick={(event) => {
            if (disabled || isActive) event.preventDefault();
          }}
        >
          {pageNumber}
          {underline}
        </a>
      );
    }

    return (
      <button
        aria-current={isActive ? "page" : undefined}
        aria-label={label}
        className={cn(pageNumberClassName, isActive ? activePageClassName : idlePageClassName, "disabled:cursor-default")}
        disabled={disabled || isActive}
        onClick={() => goToPage(pageNumber)}
        type="button"
      >
        {pageNumber}
        {underline}
      </button>
    );
  };

  const stepClassName =
    "inline-flex size-8 items-center justify-center rounded-[var(--radius-ctl)] text-[var(--text-body)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

  const renderStep = (direction: "previous" | "next") => {
    const isPrevious = direction === "previous";
    const targetPage = isPrevious ? activePage - 1 : activePage + 1;
    const blocked = disabled || (isPrevious ? activePage <= 1 : activePage >= totalPages);
    const label = isPrevious ? "上一页" : "下一页";
    const icon = isPrevious ? <ChevronLeft aria-hidden="true" className="size-4" /> : <ChevronRight aria-hidden="true" className="size-4" />;

    const href = resolvePageHref(targetPage);
    if (href && !blocked) {
      return (
        <a aria-label={label} className={stepClassName} href={href} rel={isPrevious ? "prev" : "next"} title={label}>
          {icon}
        </a>
      );
    }

    return (
      <button aria-label={label} className={stepClassName} disabled={blocked} onClick={() => goToPage(targetPage)} title={label} type="button">
        {icon}
      </button>
    );
  };

  return (
    <footer
      className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 pt-3.5 text-[0.8125rem] text-[var(--text-muted)]", className)}
      data-slot="admin-pagination"
    >
      <p>
        显示第 {firstItem} 到 {lastItem} 条，共 {total} {itemLabel}
      </p>

      {canChoosePageSize ? (
        <label className="flex items-center gap-2">
          每页
          <Select disabled={disabled} value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger aria-label="每页条数" className="w-[76px] font-mono text-[0.8125rem]" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}

      {canPaginate ? (
        <>
          <nav aria-label="分页" className="flex items-center gap-0.5 sm:ml-auto">
            <ul className="flex items-center gap-0.5">
              <li>{renderStep("previous")}</li>
              {pageItems.map((pageItem) => (
                <li key={pageItem}>
                  {typeof pageItem === "number" ? (
                    renderPageButton(pageItem)
                  ) : (
                    <span aria-hidden="true" className="inline-flex h-8 min-w-6 items-center justify-center font-mono text-[var(--text-muted)]">
                      …
                    </span>
                  )}
                </li>
              ))}
              <li>{renderStep("next")}</li>
            </ul>
          </nav>

          <form className="flex items-center gap-2" onSubmit={handleJump}>
            跳至
            <input
              aria-label="跳转页码"
              className="h-8 w-12 rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent px-1 text-center font-mono text-[0.8125rem] text-[var(--foreground)] transition-colors [appearance:textfield] hover:border-[var(--text-muted)] focus-visible:border-[var(--foreground)] disabled:opacity-55 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              disabled={disabled}
              inputMode="numeric"
              min={1}
              max={totalPages}
              onChange={(event) => setJumpValue(event.target.value)}
              type="number"
              value={jumpValue}
            />
            页
            <Button disabled={disabled} size="sm" type="submit" variant="outline">
              跳转
            </Button>
          </form>
        </>
      ) : null}
    </footer>
  );
}
