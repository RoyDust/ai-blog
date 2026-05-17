const skeletonItems = [0, 1, 2];

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`reader-skeleton rounded-full ${className}`} />;
}

function ReaderCardSkeleton() {
  return (
    <article className="reader-feed-card p-4">
      <div className="grid gap-4 md:grid-cols-[10.75rem_minmax(0,1fr)_2.75rem] md:items-center">
        <div className="reader-skeleton aspect-[1.55] rounded-[calc(var(--radius-large)-0.25rem)] md:h-28 md:aspect-auto" />
        <div className="min-w-0 space-y-4">
          <div className="flex gap-2">
            <SkeletonLine className="h-7 w-20" />
            <SkeletonLine className="h-7 w-28" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-5 w-4/5" />
            <SkeletonLine className="h-4 w-full" />
            <SkeletonLine className="h-4 w-3/5" />
          </div>
          <div className="flex gap-3">
            <SkeletonLine className="h-4 w-16" />
            <SkeletonLine className="h-4 w-16" />
            <SkeletonLine className="h-4 w-16" />
          </div>
        </div>
        <div className="reader-skeleton hidden h-11 w-11 rounded-full md:block" />
      </div>
    </article>
  );
}

export function PublicLoadingState() {
  return (
    <div aria-label="页面加载中" className="reader-section" data-testid="public-loading">
      <section className="reader-banner min-h-[18rem] px-6 py-8 md:px-8 md:py-10">
        <div className="relative z-10 max-w-2xl space-y-5">
          <SkeletonLine className="h-6 w-28" />
          <div className="space-y-3">
            <SkeletonLine className="h-9 w-4/5 max-w-xl" />
            <SkeletonLine className="h-9 w-3/5 max-w-lg" />
          </div>
          <div className="space-y-2">
            <SkeletonLine className="h-4 w-full max-w-2xl" />
            <SkeletonLine className="h-4 w-3/4 max-w-xl" />
          </div>
        </div>
      </section>

      <section className="grid gap-4">
        {skeletonItems.map((item) => (
          <ReaderCardSkeleton key={item} />
        ))}
      </section>
    </div>
  );
}

export function ArticleLoadingState() {
  return (
    <div aria-label="文章加载中" className="article-detail-page relative overflow-x-clip pb-16" data-testid="article-loading">
      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-8">
          <article className="article-shell reader-card overflow-hidden">
            <div className="reader-banner min-h-[22rem] px-6 py-10 md:px-10">
              <div className="relative z-10 max-w-3xl space-y-5">
                <SkeletonLine className="h-7 w-32" />
                <div className="space-y-3">
                  <SkeletonLine className="h-10 w-5/6 max-w-3xl" />
                  <SkeletonLine className="h-10 w-2/3 max-w-2xl" />
                </div>
                <SkeletonLine className="h-4 w-2/3 max-w-xl" />
              </div>
            </div>

            <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto max-w-[var(--article-reading-max-width)] space-y-5">
                {skeletonItems.concat([3, 4]).map((item) => (
                  <div className="space-y-3" key={item}>
                    <SkeletonLine className="h-4 w-full" />
                    <SkeletonLine className="h-4 w-11/12" />
                    <SkeletonLine className="h-4 w-4/5" />
                  </div>
                ))}
              </div>
            </div>
          </article>

          <section className="reader-panel space-y-5 p-6 sm:p-8">
            <SkeletonLine className="h-6 w-32" />
            <SkeletonLine className="h-4 w-2/3" />
            <div className="flex flex-wrap gap-3">
              <SkeletonLine className="h-11 w-28" />
              <SkeletonLine className="h-11 w-28" />
              <SkeletonLine className="h-11 w-28" />
            </div>
          </section>
        </div>

        <aside className="hidden xl:block">
          <div className="reader-panel h-[var(--article-toc-card-height)] space-y-4 p-5">
            <SkeletonLine className="h-4 w-24" />
            <SkeletonLine className="h-6 w-20" />
            <div className="space-y-3 pt-2">
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-5/6" />
              <SkeletonLine className="h-4 w-3/4" />
              <SkeletonLine className="h-4 w-4/5" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminLoadingState() {
  return (
    <div aria-label="后台加载中" className="space-y-5 2xl:space-y-6" data-testid="admin-loading">
      <section className="grid grid-cols-1 gap-5 2xl:gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(440px,0.75fr)]">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SkeletonLine className="h-6 w-28" />
            <SkeletonLine className="h-8 w-40" />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className="rounded-lg bg-[var(--surface-alt)] px-4 py-3" key={item}>
                <SkeletonLine className="h-3 w-16" />
                <SkeletonLine className="mt-3 h-6 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-6 h-[265px] rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]">
            <div className="flex h-full items-end gap-3 p-5">
              {[0, 1, 2, 3, 4, 5, 6].map((item) => (
                <div className="reader-skeleton flex-1 rounded-t-lg" key={item} style={{ height: `${32 + item * 8}%` }} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
          <SkeletonLine className="h-6 w-28" />
          <div className="mt-6 space-y-5">
            {skeletonItems.map((item) => (
              <div className="space-y-3 border-b border-[var(--border)] pb-5 last:border-b-0" key={item}>
                <SkeletonLine className="h-5 w-3/5" />
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:gap-6 xl:grid-cols-3">
        {skeletonItems.map((item) => (
          <div className="min-h-[22rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5" key={item}>
            <div className="flex items-center justify-between gap-3">
              <SkeletonLine className="h-6 w-28" />
              <SkeletonLine className="h-8 w-16" />
            </div>
            <div className="mt-6 space-y-5">
              {skeletonItems.map((row) => (
                <div className="flex gap-4" key={row}>
                  <div className="reader-skeleton h-11 w-11 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-3">
                    <SkeletonLine className="h-5 w-3/5" />
                    <SkeletonLine className="h-4 w-full" />
                    <SkeletonLine className="h-4 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
