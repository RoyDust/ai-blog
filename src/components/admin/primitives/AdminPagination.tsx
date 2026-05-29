"use client";

import { type FormEvent, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/admin/ui";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "@/components/shadcn/ui/pagination";
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

  useEffect(() => {
    setJumpValue(String(activePage));
  }, [activePage]);

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

  const renderPageButton = (pageNumber: number) => {
    const isActive = pageNumber === activePage;
    const label = `第 ${pageNumber} 页`;

    const href = resolvePageHref(pageNumber);
    if (href) {
      return (
        <PaginationLink
          aria-label={label}
          href={href}
          isActive={isActive}
          size="icon-sm"
          onClick={(event) => {
            if (disabled || isActive) event.preventDefault();
          }}
          className={cn("rounded-xl", isActive ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)] hover:text-white" : "")}
        >
          {pageNumber}
        </PaginationLink>
      );
    }

    return (
      <button
        aria-current={isActive ? "page" : undefined}
        aria-label={label}
        className={cn(
          buttonVariants({ variant: isActive ? "default" : "ghost", size: "icon-sm" }),
          "rounded-xl",
          isActive ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]" : "",
        )}
        disabled={disabled || isActive}
        onClick={() => goToPage(pageNumber)}
        type="button"
      >
        {pageNumber}
      </button>
    );
  };

  const renderStep = (direction: "previous" | "next") => {
    const isPrevious = direction === "previous";
    const targetPage = isPrevious ? activePage - 1 : activePage + 1;
    const blocked = disabled || (isPrevious ? activePage <= 1 : activePage >= totalPages);
    const label = isPrevious ? "上一页" : "下一页";
    const icon = isPrevious ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />;

    const href = resolvePageHref(targetPage);
    if (href && !blocked) {
      return (
        <PaginationLink aria-label={label} className="rounded-xl" href={href} size="icon-sm" title={label}>
          {icon}
        </PaginationLink>
      );
    }

    return (
      <button
        aria-label={label}
        className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "rounded-xl")}
        disabled={blocked}
        onClick={() => goToPage(targetPage)}
        title={label}
        type="button"
      >
        {icon}
      </button>
    );
  };

  return (
    <footer className={cn("flex flex-col gap-3 border-t border-[var(--border)] bg-[var(--surface-alt)]/35 px-5 py-4 xl:flex-row xl:items-center xl:justify-between", className)}>
      <p className="text-sm text-[var(--muted)]">
        显示第 {firstItem} 到 {lastItem} 条，共 {total} {itemLabel}
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        {canChoosePageSize ? (
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            每页
            <Select disabled={disabled} value={String(pageSize)} onValueChange={handlePageSizeChange}>
              <SelectTrigger className="h-9 w-[86px] rounded-xl border-[var(--border)] bg-[var(--surface)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
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
            <Pagination className="mx-0 w-auto justify-start sm:justify-center" aria-label="分页">
              <PaginationContent>
                <PaginationItem>{renderStep("previous")}</PaginationItem>
                {pageItems.map((pageItem) => (
                  <PaginationItem key={pageItem}>
                    {typeof pageItem === "number" ? renderPageButton(pageItem) : <PaginationEllipsis />}
                  </PaginationItem>
                ))}
                <PaginationItem>{renderStep("next")}</PaginationItem>
              </PaginationContent>
            </Pagination>

            <form className="flex items-center gap-2 text-sm text-[var(--muted)]" onSubmit={handleJump}>
              跳至
              <input
                aria-label="跳转页码"
                className="ui-ring h-9 w-16 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 text-center text-sm text-[var(--foreground)]"
                disabled={disabled}
                inputMode="numeric"
                min={1}
                max={totalPages}
                onChange={(event) => setJumpValue(event.target.value)}
                type="number"
                value={jumpValue}
              />
              页
              <button className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-xl")} disabled={disabled} type="submit">
                跳转
              </button>
            </form>
          </>
        ) : null}
      </div>
    </footer>
  );
}
