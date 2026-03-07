interface SearchFormProps {
  defaultValue?: string
  action?: string
  buttonLabel?: string
  inputLabel?: string
  placeholder?: string
  compact?: boolean
}

export function SearchForm({
  defaultValue = '',
  action = '/search',
  buttonLabel = '搜索',
  inputLabel = '搜索文章',
  placeholder = '搜索文章、标签、分类',
  compact = false,
}: SearchFormProps) {
  return (
    <form action={action} className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`} method="get" role="search">
      <label className="sr-only" htmlFor="site-search-input">
        {inputLabel}
      </label>
      <input
        aria-label={inputLabel}
        className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
        defaultValue={defaultValue}
        id="site-search-input"
        name="q"
        placeholder={placeholder}
        type="search"
      />
      <button className="ui-btn shrink-0 bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--brand-strong)]" type="submit">
        {buttonLabel}
      </button>
    </form>
  )
}
