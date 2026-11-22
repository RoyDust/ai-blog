export default function PostLoading() {
  return (
    <div className="article-detail-page relative overflow-x-clip pb-16">
      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-5">
          <article className="article-shell reader-card overflow-hidden">
            <div className="reader-banner !min-h-0 !rounded-none !border-0 !bg-none !shadow-none before:!hidden px-5 pt-6 pb-2 sm:px-7 lg:px-9 lg:pt-8">
              <div className="mx-auto w-full max-w-[var(--article-reading-max-width)] space-y-3.5">
                <div className="reader-skeleton h-3.5 w-44 rounded-full" />
                <div className="reader-skeleton h-3.5 w-64 rounded-full" />
                <div className="reader-skeleton h-8 w-4/5 rounded-xl" />
                <div className="reader-skeleton h-16 w-full rounded-xl" />
              </div>
            </div>
            <div className="px-5 pt-4 pb-7 sm:px-7 lg:px-9 lg:pb-9">
              <div className="mx-auto max-w-[var(--article-reading-max-width)] space-y-3.5">
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
          <div className="reader-panel space-y-3 p-4">
            <div className="reader-skeleton h-4 w-20 rounded-full" />
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
