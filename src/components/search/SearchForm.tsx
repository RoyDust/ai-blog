import { Search } from "lucide-react";

interface SearchFormProps {
  defaultValue?: string
  action?: string
  buttonLabel?: string
  inputLabel?: string
  placeholder?: string
  compact?: boolean
  appearance?: "default" | "navbar"
}

export function SearchForm({
  defaultValue = '',
  action = '/search',
  buttonLabel = '搜索',
  inputLabel = '搜索站内内容',
  placeholder = '搜索文章、标签或分类',
  compact = false,
  appearance = 'default',
}: SearchFormProps) {
  const isNavbar = appearance === 'navbar'

  return (
    <form
      action={action}
      className={`flex items-center gap-2 ${compact && !isNavbar ? '' : 'w-full'} ${isNavbar ? 'justify-end' : ''}`}
      method="get"
      role="search"
    >
      <label className="sr-only" htmlFor="site-search-input">
        {inputLabel}
      </label>

      {isNavbar ? (
        <div className="group relative w-full">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] transition-colors duration-200 group-focus-within:text-[var(--brand)]" />
          <input
            aria-label={inputLabel}
            className="ui-ring h-8 w-full rounded-[0.5625rem] border border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-muted)_62%,transparent)] pr-2.5 pl-8 text-xs text-[var(--foreground)] placeholder:text-[var(--text-muted)] transition-[background-color,border-color,box-shadow] duration-200 ease-out focus-visible:border-[color:color-mix(in_oklab,var(--brand)_36%,var(--reader-border))] focus-visible:bg-[var(--reader-panel-elevated)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--brand)_20%,transparent)]"
            defaultValue={defaultValue}
            id="site-search-input"
            name="q"
            placeholder={placeholder}
            type="search"
          />
        </div>
      ) : (
        <>
          <input
            aria-label={inputLabel}
            className="ui-ring h-9.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-[background-color,border-color,box-shadow] duration-200 ease-out focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
            defaultValue={defaultValue}
            id="site-search-input"
            name="q"
            placeholder={placeholder}
            type="search"
          />
          <button className="ui-btn shrink-0 bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90" type="submit">
            {buttonLabel}
          </button>
        </>
      )}
    </form>
  )
}
