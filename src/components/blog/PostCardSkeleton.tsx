export function PostCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="card-base relative overflow-hidden rounded-[var(--radius-large)] p-6 md:p-8"
      data-testid="post-card-skeleton"
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_28%] md:items-stretch">
        <div className="space-y-4">
          <div className="h-8 w-3/4 animate-pulse rounded-xl bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
          <div className="h-4 w-2/5 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_8%,transparent)]" />
          <div className="space-y-2">
            <div className="h-4 w-full animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
          </div>
          <div className="flex gap-3">
            <div className="h-4 w-16 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-[color:color-mix(in_srgb,var(--foreground)_7%,transparent)]" />
          </div>
        </div>
        <div className="hidden animate-pulse rounded-2xl bg-[color:color-mix(in_srgb,var(--foreground)_6%,transparent)] md:block" />
      </div>
    </div>
  )
}
