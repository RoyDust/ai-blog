import Link from "next/link";

interface FilterBarProps {
  search?: string;
  category?: string;
  tag?: string;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
}

function buildFilterHref({
  search,
  category,
  tag,
}: {
  search?: string;
  category?: string;
  tag?: string;
}) {
  const params = new URLSearchParams();

  if (search) params.set("q", search);
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);

  const query = params.toString();
  return query ? `/posts?${query}` : "/posts";
}

export function FilterBar({ search, category, tag, categories, tags }: FilterBarProps) {
  const hasActiveFilters = Boolean(search || category || tag);

  return (
    <form
      className="card-base sticky z-30 space-y-4 p-4"
      method="get"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 1rem)" }}
    >
      <div className="grid gap-3 lg:grid-cols-[repeat(2,minmax(0,1fr))_auto]">
        <select name="category" defaultValue={category ?? ""} className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          <option value="">全部分类</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <select name="tag" defaultValue={tag ?? ""} className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]">
          <option value="">全部标签</option>
          {tags.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
        <button className="ui-btn rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" type="submit">
          应用筛选
        </button>
      </div>

      {hasActiveFilters ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
          {search ? <Link className="ui-chip" href={buildFilterHref({ category, tag })}>关键词: {search}</Link> : null}
          {category ? <Link className="ui-chip" href={buildFilterHref({ search, tag })}>分类: {category}</Link> : null}
          {tag ? <Link className="ui-chip" href={buildFilterHref({ search, category })}>标签: {tag}</Link> : null}
          <Link className="text-sm font-medium text-[var(--brand)]" href="/posts">清空筛选</Link>
        </div>
      ) : null}
    </form>
  );
}
