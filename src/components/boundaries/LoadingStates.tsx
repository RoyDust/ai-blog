import { SkeletonBar } from "@/components/editorial";
import { cn } from "@/lib/cn";

/*
 * 路由级加载骨架（简报 16.1「骨架」）：不画灰色圆角块，只画与真实内容同尺寸的细条
 * （foreground 6% 底、2px 圆角），区块之间照样画 1px 细线 / 2px 报头线。
 */

const skeletonItems = [0, 1, 2];

function SkeletonLine({ className = "", strong = false }: { className?: string; strong?: boolean }) {
  return <SkeletonBar className={cn("block", className)} strong={strong} />;
}

export function ArticleLoadingState() {
  return (
    <div aria-label="文章加载中" aria-busy="true" className="article-detail-page relative overflow-x-clip pb-16" data-testid="article-loading">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_1px_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-8">
          <header className="space-y-4 border-b-2 border-[var(--reader-border)] pb-6">
            <SkeletonLine className="h-3 w-40" />
            <div className="space-y-3">
              <SkeletonLine strong className="h-8 w-5/6 max-w-3xl" />
              <SkeletonLine strong className="h-8 w-2/3 max-w-2xl" />
            </div>
            <SkeletonLine className="h-4 w-2/3 max-w-xl" />
            <SkeletonLine className="h-3 w-56" />
          </header>

          <div className="mx-auto max-w-[var(--article-reading-max-width)] space-y-6">
            {skeletonItems.concat([3, 4]).map((item) => (
              <div className="space-y-3" key={item}>
                <SkeletonLine className="h-4 w-full" />
                <SkeletonLine className="h-4 w-11/12" />
                <SkeletonLine className="h-4 w-4/5" />
              </div>
            ))}
          </div>

          <section className="space-y-4 border-t border-[var(--border)] pt-6">
            <SkeletonLine strong className="h-5 w-32" />
            <SkeletonLine className="h-4 w-2/3" />
            <div className="flex flex-wrap gap-5">
              <SkeletonLine className="h-4 w-20" />
              <SkeletonLine className="h-4 w-20" />
              <SkeletonLine className="h-4 w-20" />
            </div>
          </section>
        </div>

        <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] xl:block" />

        <aside className="hidden xl:block">
          <div className="space-y-4">
            <SkeletonLine strong className="h-5 w-20" />
            <div className="space-y-3 border-t border-[var(--border)] pt-4">
              <SkeletonLine className="h-3.5 w-full" />
              <SkeletonLine className="h-3.5 w-5/6" />
              <SkeletonLine className="h-3.5 w-3/4" />
              <SkeletonLine className="h-3.5 w-4/5" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminLoadingState() {
  return (
    <div aria-label="后台加载中" aria-busy="true" className="space-y-7" data-testid="admin-loading">
      <header className="space-y-2.5 border-b-2 border-[var(--reader-border)] pb-4">
        <SkeletonLine className="h-3 w-20" />
        <SkeletonLine strong className="h-7 w-40" />
        <SkeletonLine className="h-3 w-56" />
      </header>

      <section className="grid grid-cols-1 gap-x-8 gap-y-7 xl:grid-cols-[minmax(0,1.45fr)_1px_minmax(440px,0.75fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
            <SkeletonLine strong className="h-5 w-28" />
            <SkeletonLine className="h-4 w-40" />
          </div>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <div className={cn("px-4 py-1 first:pl-0", item > 0 && "sm:border-l sm:border-[var(--border)]")} key={item}>
                <SkeletonLine className="h-3 w-16" />
                <SkeletonLine strong className="mt-3 h-6 w-20" />
              </div>
            ))}
          </div>
          <div
            aria-hidden="true"
            className="mt-6 grid h-[265px] grid-rows-4 border-b border-[var(--border)]"
          >
            {[0, 1, 2, 3].map((row) => (
              <div className="border-t border-[var(--border)]" key={row} />
            ))}
          </div>
        </div>

        <span aria-hidden="true" className="hidden self-stretch bg-[var(--border)] xl:block" />

        <div className="min-w-0">
          <div className="border-b border-[var(--border)] pb-3">
            <SkeletonLine strong className="h-5 w-28" />
          </div>
          <div>
            {skeletonItems.map((item) => (
              <div className="space-y-2.5 border-b border-[var(--border)] py-4" key={item}>
                <SkeletonLine strong className="h-4 w-3/5" />
                <SkeletonLine className="h-3.5 w-full" />
                <SkeletonLine className="h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-x-8 gap-y-7 xl:grid-cols-3">
        {skeletonItems.map((item) => (
          <div className={cn("min-w-0", item > 0 && "xl:border-l xl:border-[var(--border)] xl:pl-8")} key={item}>
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <SkeletonLine strong className="h-5 w-28" />
              <SkeletonLine className="h-4 w-14" />
            </div>
            <div>
              {skeletonItems.map((row) => (
                <div className="space-y-2.5 border-b border-[var(--border)] py-3.5" key={row}>
                  <SkeletonLine strong className="h-4 w-3/5" />
                  <SkeletonLine className="h-3 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
