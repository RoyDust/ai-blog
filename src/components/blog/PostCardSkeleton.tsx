export function PostCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="reader-feed-card grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_13rem] md:items-stretch"
      data-testid="post-card-skeleton"
    >
      <div className="min-w-0 space-y-3 p-4 sm:px-5 sm:py-4">
        <div className="reader-skeleton h-5 w-4/5 rounded-md" />
        <div className="flex gap-2">
          <div className="reader-skeleton h-5 w-20 rounded-md" />
          <div className="reader-skeleton h-5 w-16 rounded-md" />
        </div>
        <div className="space-y-1.5">
          <div className="reader-skeleton h-4 w-full rounded-md" />
          <div className="reader-skeleton h-4 w-3/5 rounded-md" />
        </div>
        <div className="flex gap-3 pt-1">
          <div className="reader-skeleton h-3.5 w-14 rounded-md" />
          <div className="reader-skeleton h-3.5 w-14 rounded-md" />
        </div>
      </div>
      <div className="reader-skeleton mx-3 mb-3 aspect-[1.55] rounded-xl md:m-2.5 md:ml-0 md:h-auto md:min-h-[8.75rem] md:aspect-auto" />
    </div>
  )
}
