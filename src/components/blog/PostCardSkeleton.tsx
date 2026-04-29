export function PostCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="reader-feed-card p-4"
      data-testid="post-card-skeleton"
    >
      <div className="grid gap-4 md:grid-cols-[10.75rem_minmax(0,1fr)_2.75rem] md:items-center">
        <div className="reader-skeleton aspect-[1.55] rounded-[calc(var(--radius-large)-0.25rem)] md:h-28 md:aspect-auto" />
        <div className="min-w-0 space-y-4">
          <div className="flex gap-2">
            <div className="reader-skeleton h-7 w-20 rounded-full" />
            <div className="reader-skeleton h-7 w-28 rounded-full" />
          </div>
          <div className="space-y-2">
            <div className="reader-skeleton h-5 w-4/5 rounded-full" />
            <div className="reader-skeleton h-4 w-full rounded-full" />
            <div className="reader-skeleton h-4 w-3/5 rounded-full" />
          </div>
          <div className="flex gap-3">
            <div className="reader-skeleton h-4 w-16 rounded-full" />
            <div className="reader-skeleton h-4 w-16 rounded-full" />
            <div className="reader-skeleton h-4 w-16 rounded-full" />
          </div>
        </div>
        <div className="reader-skeleton hidden h-11 w-11 rounded-full md:block" />
      </div>
    </div>
  )
}
