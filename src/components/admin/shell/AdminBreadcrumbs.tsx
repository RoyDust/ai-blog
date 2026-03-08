interface AdminBreadcrumbsProps {
  items: string[];
}

export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb">
      <p className="text-sm text-[var(--muted)]">{items.join(" / ")}</p>
    </nav>
  );
}
