"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

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
    return "admin-theme flex min-h-[calc(100vh-8rem)] items-center justify-center text-[var(--foreground)]";
  }

  if (scope === "root") {
    return "reader-shell flex min-h-screen items-center justify-center px-4 py-12 text-[var(--foreground)]";
  }

  return "flex min-h-[52vh] items-center justify-center py-10 text-[var(--foreground)]";
}

function getPanelClassName(scope: ErrorScope) {
  if (scope === "admin") {
    return "w-full max-w-2xl overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8";
  }

  return "reader-panel w-full max-w-2xl overflow-hidden p-6 sm:p-8";
}

function getDigestClassName(scope: ErrorScope) {
  if (scope === "admin") {
    return "mt-4 break-all rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-xs text-[var(--text-muted)]";
  }

  return "mt-4 break-all rounded-lg border border-[var(--reader-border)] bg-[var(--reader-panel-muted)] px-3 py-2 text-xs text-[var(--text-muted)]";
}

export function RouteErrorState({ error, reset, scope = "public" }: RouteErrorStateProps) {
  const copy = scopeCopy[scope];

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={getFrameClassName(scope)} data-testid={`${scope}-route-error`}>
      <section className={getPanelClassName(scope)} role="alert">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-foreground)]">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--danger-foreground)]">{copy.eyebrow}</p>
            <h1 className="mt-3 text-2xl font-bold leading-tight text-[var(--foreground)] sm:text-3xl">{copy.title}</h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-[var(--text-body)] sm:text-base">{copy.description}</p>

            {error.digest ? (
              <p className={getDigestClassName(scope)}>
                错误编号：{error.digest}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="gap-2 rounded-full" onClick={reset} type="button">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                重试
              </Button>
              <Button asChild className="gap-2 rounded-full" variant="secondary">
                <Link href={copy.homeHref}>
                  <Home className="h-4 w-4" aria-hidden="true" />
                  {scope === "admin" ? "回到后台" : "回到首页"}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
