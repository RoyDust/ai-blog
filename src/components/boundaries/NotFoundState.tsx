import Link from "next/link";
import { ArrowLeft, Home, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

type NotFoundScope = "root" | "public";

interface NotFoundStateProps {
  scope?: NotFoundScope;
}

function getFrameClassName(scope: NotFoundScope) {
  if (scope === "root") {
    return "reader-shell flex min-h-screen items-center justify-center px-4 py-12 text-[var(--foreground)]";
  }

  return "flex min-h-[52vh] items-center justify-center py-10 text-[var(--foreground)]";
}

export function NotFoundState({ scope = "public" }: NotFoundStateProps) {
  return (
    <div className={getFrameClassName(scope)} data-testid={`${scope}-not-found`}>
      <section className="reader-panel w-full max-w-2xl overflow-hidden p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] text-[var(--brand)]">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">404</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">没有找到这个页面</h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-[var(--text-body)] sm:text-base">
              这篇内容可能已下线、链接拼写有误，或页面已经移动到新的地址。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="gap-2 rounded-full">
                <Link href="/">
                  <Home className="h-4 w-4" aria-hidden="true" />
                  回到首页
                </Link>
              </Button>
              <Button asChild className="gap-2 rounded-full" variant="secondary">
                <Link href="/posts">
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  查看文章
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
