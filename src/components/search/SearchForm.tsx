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
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] transition-colors duration-200 group-focus-within:text-[var(--foreground)]" />
          <input
            aria-label={inputLabel}
            className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-3 pl-8 text-[0.8125rem] text-[var(--foreground)] transition-[border-color,width] duration-200 ease-out placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)]"
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
            className="ed-input"
            defaultValue={defaultValue}
            id="site-search-input"
            name="q"
            placeholder={placeholder}
            type="search"
          />
          <button className="ed-btn" type="submit">
            {buttonLabel}
          </button>
        </>
      )}
    </form>
  )
}
