interface FilterBarProps {
  search?: string;
  category?: string;
  tag?: string;
  categories: Array<{ name: string; slug: string }>;
  tags: Array<{ name: string; slug: string }>;
}

export function FilterBar({ search, category, tag, categories, tags }: FilterBarProps) {
  return (
    <form className="ui-surface mb-6 grid gap-3 rounded-2xl p-4 md:grid-cols-4" method="get">
      <input
        name="q"
        defaultValue={search}
        placeholder="搜索文章、作者、关键词"
        className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      />
      <select
        name="category"
        defaultValue={category ?? ""}
        className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <option value="">全部分类</option>
        {categories.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <select
        name="tag"
        defaultValue={tag ?? ""}
        className="ui-ring rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <option value="">全部标签</option>
        {tags.map((item) => (
          <option key={item.slug} value={item.slug}>
            {item.name}
          </option>
        ))}
      </select>
      <button className="ui-btn bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" type="submit">
        应用筛选
      </button>
    </form>
  );
}
