"use client";

import { useEffect } from "react";
import { Reveal, TextLink } from "@/components/editorial";
import { cn } from "@/lib/cn";

type ErrorScope = "root" | "public" | "admin";

interface RouteErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  scope?: ErrorScope;
}

const scopeCopy: Record<ErrorScope, { eyebrow: string; title: string; description: string; homeHref: string }> = {
  root: {
    eyebrow: "系统异常",
    title: "页面暂时无法打开",
    description: "刚才的渲染过程被中断。你可以重试当前页面，或回到首页继续浏览。",
    homeHref: "/",
  },
  public: {
    eyebrow: "阅读中断",
    title: "这页内容暂时没能加载",
    description: "可能是数据读取或页面渲染遇到异常。重试通常可以恢复。",
    homeHref: "/",
  },
  admin: {
    eyebrow: "后台异常",
    title: "当前后台页面加载失败",
    description: "当前操作没有完成。请先重试页面，若仍失败再返回后台首页处理其他任务。",
    homeHref: "/admin",
  },
};

function getFrameClassName(scope: ErrorScope) {
  if (scope === "admin") {
    return "admin-theme flex min-h-[calc(100vh-8rem)] items-center py-10 text-[var(--foreground)]";
  }

  if (scope === "root") {
    return "flex min-h-screen items-center bg-[var(--page-bg)] px-4 py-12 text-[var(--foreground)] sm:px-6";
  }

  return "flex min-h-[40vh] items-center py-10 text-[var(--foreground)]";
}

/**
 * 路由错误边界（简报 16.1「空态与错误态」）：不加容器，一句 danger 色衬线文案 +
 * 描边按钮「重试」+ 文字链接，整体左对齐；后台按第 13 节用 36px 小号按钮。
 */
export function RouteErrorState({ error, reset, scope = "public" }: RouteErrorStateProps) {
  const copy = scopeCopy[scope];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={getFrameClassName(scope)} data-testid={`${scope}-route-error`}>
      <Reveal className={cn("w-full", scope === "root" && "mx-auto max-w-[36rem]")}>
        <section className="space-y-3" role="alert">
          <p className="ed-eyebrow">{copy.eyebrow}</p>
          <h1 className="ed-empty__title ed-empty__title--danger text-[1.0625rem] sm:text-[1.25rem]">{copy.title}</h1>
          <p className="max-w-prose text-[0.875rem] leading-6 text-[var(--text-muted)]">{copy.description}</p>

          {error.digest ? (
            <p className="ed-mono break-all text-[0.75rem] text-[var(--text-muted)]">错误编号：{error.digest}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            <button className={cn("ed-btn-outline", scope === "admin" && "ed-btn--sm")} onClick={reset} type="button">
              重试
            </button>
            <TextLink href={copy.homeHref}>{scope === "admin" ? "回到后台" : "回到首页"}</TextLink>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
