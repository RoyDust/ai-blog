import { Reveal, TextLink } from "@/components/editorial";
import { cn } from "@/lib/cn";

type NotFoundScope = "root" | "public";

interface NotFoundStateProps {
  scope?: NotFoundScope;
}

/**
 * 404（简报 16.1「空态与错误态」）：不加容器，一句衬线文案 + 文字链接，整体左对齐。
 * - public：落在 AppShell 的纸面主列里；
 * - root：没有外壳，页面底色上留一列 36rem 的内容宽度。
 */
export function NotFoundState({ scope = "public" }: NotFoundStateProps) {
  return (
    <div
      className={cn(
        "text-[var(--foreground)]",
        scope === "root"
          ? "flex min-h-screen items-center bg-[var(--page-bg)] px-4 py-12 sm:px-6"
          : "flex min-h-[40vh] items-center py-10",
      )}
      data-testid={`${scope}-not-found`}
    >
      <Reveal className={cn("w-full space-y-3", scope === "root" && "mx-auto max-w-[36rem]")}>
        <p className="ed-eyebrow ed-mono">404</p>
        <h1 className="ed-empty__title text-[1.0625rem] sm:text-[1.25rem]">没有找到这个页面</h1>
        <p className="max-w-prose text-[0.875rem] leading-6 text-[var(--text-muted)]">
          这篇内容可能已下线、链接拼写有误，或页面已经移动到新的地址。
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1">
          <TextLink href="/">回到首页</TextLink>
          <TextLink href="/posts">查看文章</TextLink>
        </div>
      </Reveal>
    </div>
  );
}
