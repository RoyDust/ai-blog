import Link from "next/link";

import type { AdminBreadcrumb } from "./config";

interface AdminBreadcrumbsProps {
  items: AdminBreadcrumb[];
}

export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm text-[var(--muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="flex min-w-0 items-center gap-2" key={`${item.href}-${item.label}`}>
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 select-none">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate text-[var(--foreground)]">
                  {item.label}
                </span>
              ) : (
                <Link className="truncate transition-colors hover:text-[var(--foreground)]" href={item.href}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
