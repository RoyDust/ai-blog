interface AdminBreadcrumbsProps {
  items: string[];
}

export function AdminBreadcrumbs({ items }: AdminBreadcrumbsProps) {
  return (
    <p className="text-sm text-[var(--muted)]">{items.join(" / ")}</p>
  );
}
