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
            className="h-9 w-full rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] bg-transparent pr-3 pl-8 text-[0.8125rem] text-[var(--foreground)] transition-[border-color] duration-200 ease-out placeholder:text-[var(--text-muted)] hover:border-[var(--text-muted)]"
            defaultValue={defaultValue}
            id="site-search-input"
            name="q"
            placeholder={placeholder}
            type="search"
          />
        </div>
      ) : (
        <>
          <div className="group relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] transition-colors duration-200 group-focus-within:text-[var(--foreground)]"
            />
            {/* 手机上 16px 字号，避免 iOS Safari 聚焦时自动放大页面 */}
            <input
              aria-label={inputLabel}
              className="ed-input pl-9 text-base sm:text-[0.9375rem]"
              defaultValue={defaultValue}
              id="site-search-input"
              name="q"
              placeholder={placeholder}
              type="search"
            />
          </div>
          <button className="ed-btn" type="submit">
            {buttonLabel}
          </button>
        </>
      )}
    </form>
  )
}
