import Link from "next/link";

import type { AdminBreadcrumb } from "./config";

interface AdminBreadcrumbsProps {
  items: AdminBreadcrumb[];
}

/** 面包屑：「/」分隔，链接 muted、悬停 foreground，当前项 foreground 700 */
export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center text-[0.875rem] whitespace-nowrap text-[var(--text-muted)]">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="flex min-w-0 items-center" key={`${item.href}-${item.label}`}>
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 px-2 text-[var(--reader-border-strong)] select-none">
                  /
                </span>
              ) : null}
              {isLast ? (
                <span aria-current="page" className="truncate font-bold text-[var(--foreground)]">
                  {item.label}
                </span>
              ) : (
                <Link className="truncate transition-colors duration-150 hover:text-[var(--foreground)]" href={item.href}>
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
