export default function PostLoading() {
  return (
    <div className="article-detail-page relative overflow-x-clip pb-16">
      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-8">
          <article className="article-shell reader-card overflow-hidden">
            <div className="reader-banner flex min-h-[clamp(22rem,42vw,33rem)] items-end">
              <div className="reader-skeleton absolute inset-0" />
              <div className="relative z-10 w-full space-y-4 p-6 sm:p-8 lg:p-10">
                <div className="reader-skeleton h-4 w-40 rounded-full" />
                <div className="reader-skeleton h-12 w-3/4 rounded-2xl" />
                <div className="reader-skeleton h-6 w-1/2 rounded-full" />
              </div>
            </div>
            <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto max-w-[var(--article-reading-max-width)] space-y-4">
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-5/6 rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-11/12 rounded-full" />
                <div className="reader-skeleton h-4 w-2/3 rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-5/6 rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-11/12 rounded-full" />
                <div className="reader-skeleton h-4 w-2/3 rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-5/6 rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-11/12 rounded-full" />
                <div className="reader-skeleton h-4 w-2/3 rounded-full" />
              </div>
            </div>
          </article>
        </div>
        <aside className="article-toc-rail hidden xl:sticky xl:block">
          <div className="reader-panel space-y-3 p-5">
            <div className="reader-skeleton h-3 w-24 rounded-full" />
            <div className="reader-skeleton h-5 w-32 rounded-full" />
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="reader-skeleton h-3 w-full rounded-full"
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
