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
      className={`flex items-center gap-2 ${compact ? '' : 'w-full'} ${isNavbar ? 'justify-end' : ''}`}
      method="get"
      role="search"
    >
      <label className="sr-only" htmlFor="site-search-input">
        {inputLabel}
      </label>

      {isNavbar ? (
        <div className="group relative w-full lg:w-auto">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-[18px] w-[18px] -translate-y-1/2 text-[var(--muted)] transition-colors duration-200 group-focus-within:text-[var(--primary)]" />
          <input
            aria-label={inputLabel}
            className="ui-ring h-11 w-full rounded-2xl border border-transparent bg-[color:color-mix(in_srgb,var(--foreground)_5%,var(--surface))] pr-4 pl-11 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition-[width,background-color,border-color,box-shadow] duration-200 ease-out focus-visible:border-[color:color-mix(in_srgb,var(--primary)_28%,transparent)] focus-visible:bg-[var(--surface)] focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_srgb,var(--primary)_18%,transparent)] lg:w-40 lg:focus:w-64"
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
            className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
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
