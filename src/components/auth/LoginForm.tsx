"use client";

import type { Session } from "next-auth";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import { ArrowRight, Github, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { Button, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getPostLoginRedirect } from "@/lib/login-redirect";

export type LoginFormMode = "page" | "dialog";

export type LoginFormCopy = {
  eyebrow: string;
  title: string;
  description: string;
  submitLabel: string;
  submittingLabel: string;
  githubLabel: string;
  registerPrompt: string;
  registerLinkLabel: string;
  registerSuffix?: string;
};

export type LoginFormProps = {
  mode?: LoginFormMode;
  callbackUrl?: string;
  oauthCallbackUrl?: string;
  authError?: string | null;
  copy?: Partial<LoginFormCopy>;
  onAdminSuccess?: () => void;
  onSuccess?: (session: Session | null) => void;
};

const loginFormCopyByMode: Record<LoginFormMode, LoginFormCopy> = {
  page: {
    eyebrow: "编辑工作台",
    title: "后台登录",
    description: "进入内容工作室，管理文章、评论与分类结构。",
    submitLabel: "进入后台",
    submittingLabel: "正在验证...",
    githubLabel: "使用 GitHub 登录",
    registerPrompt: "没有账号？",
    registerLinkLabel: "创建账号",
    registerSuffix: "，再由管理员分配后台权限。",
  },
  dialog: {
    eyebrow: "账号",
    title: "登录账号",
    description: "登录后可收藏文章、继续阅读，并查看与你相关的内容。",
    submitLabel: "登录",
    submittingLabel: "正在登录...",
    githubLabel: "使用 GitHub 登录",
    registerPrompt: "没有账号？",
    registerLinkLabel: "创建账号",
  },
};

const errorMessages: Record<string, string> = {
  "not-admin": "当前不是管理员账号，请切换到拥有后台权限的账号。",
  OAuthAccountNotLinked: "该邮箱已注册，请先使用邮箱密码登录，然后在设置页绑定 GitHub。",
  GitHubEmailRequired: "GitHub 未返回可用邮箱，请在 GitHub 账号中添加并验证邮箱后重试。",
  Configuration: "GitHub 登录暂未正确配置，请联系管理员。",
};

export function LoginForm({
  mode = "page",
  callbackUrl = "/admin",
  oauthCallbackUrl = "/auth/redirect",
  authError,
  copy,
  onAdminSuccess,
  onSuccess,
}: LoginFormProps) {
  const formCopy = { ...loginFormCopyByMode[mode], ...copy };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const helperMessage = authError ? errorMessages[authError] ?? "登录失败，请稍后重试。" : "";
  const isDialog = mode === "dialog";
  const HeaderIcon = isDialog ? Sparkles : ShieldCheck;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        throw new Error(result.error);
      }

      const session = await getSession();

      if (mode === "dialog") {
        if (session?.user?.role === "ADMIN") {
          if (onAdminSuccess) {
            onAdminSuccess();
          } else {
            window.location.assign("/admin");
          }
          return;
        }

        onSuccess?.(session);
        return;
      }

      window.location.href = getPostLoginRedirect(session?.user?.role, callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border",
        isDialog
          ? "reader-panel border-[var(--reader-border)] bg-[var(--reader-panel)] shadow-[var(--reader-shadow)] backdrop-blur-xl"
          : "card-base ui-surface border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden border-b px-5 py-5 sm:px-6",
          isDialog
            ? "border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_68%,transparent)]"
            : "border-[var(--border)] bg-[var(--surface-alt)]",
        )}
      >
        {isDialog ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(82%_116%_at_88%_0%,color-mix(in_oklab,var(--accent-warm)_18%,transparent),transparent_56%),radial-gradient(78%_92%_at_0%_10%,color-mix(in_oklab,var(--accent-sky)_20%,transparent),transparent_62%)]"
          />
        ) : null}

        <div className="relative flex items-start justify-between gap-4 pr-11">
          <div className="min-w-0">
            <p
              className={cn(
                "text-xs font-bold uppercase text-[var(--muted)]",
                isDialog ? "tracking-[0.16em] text-[var(--post-card-text-accent-label)]" : "tracking-[0.24em]",
              )}
            >
              {formCopy.eyebrow}
            </p>
            <h1
              className={cn(
                "mt-2 font-display font-semibold leading-tight text-[var(--foreground)]",
                isDialog ? "text-2xl sm:text-[1.75rem]" : "text-3xl",
              )}
            >
              {formCopy.title}
            </h1>
            <p className={cn("mt-3 max-w-sm text-sm leading-6", isDialog ? "text-[var(--text-body)]" : "text-[var(--muted)]")}>
              {formCopy.description}
            </p>
          </div>

          <div
            className={cn(
              "hidden h-12 w-12 shrink-0 items-center justify-center sm:flex",
              isDialog
                ? "rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_34%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] text-[var(--accent-warm)]"
                : "rounded-2xl bg-[var(--surface)] text-[var(--brand)] shadow-[var(--shadow-card)]",
            )}
          >
            <HeaderIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-6 sm:py-6">
        {error ? (
          <div className="ui-alert-danger mb-4 rounded-2xl px-4 py-3">
            <p className="text-sm">{error}</p>
          </div>
        ) : null}

        {!error && helperMessage ? (
          <div className="ui-alert-danger mb-4 rounded-2xl px-4 py-3">
            <p className="text-sm">{helperMessage}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="邮箱"
            placeholder="admin@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            leftSlot={isDialog ? <Mail className="h-4 w-4" aria-hidden="true" /> : undefined}
            className={cn(
              isDialog &&
                "h-12 rounded-2xl border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_60%,transparent)] text-sm shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] placeholder:text-[var(--text-muted)] focus-visible:border-[color:color-mix(in_oklab,var(--accent-sky)_38%,var(--reader-border))] focus-visible:ring-[color:color-mix(in_oklab,var(--accent-sky)_22%,transparent)]",
            )}
            required
          />

          <Input
            type="password"
            label="密码"
            placeholder="输入账号密码"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            leftSlot={isDialog ? <KeyRound className="h-4 w-4" aria-hidden="true" /> : undefined}
            className={cn(
              isDialog &&
                "h-12 rounded-2xl border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_60%,transparent)] text-sm shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_6%,transparent)] placeholder:text-[var(--text-muted)] focus-visible:border-[color:color-mix(in_oklab,var(--accent-sky)_38%,var(--reader-border))] focus-visible:ring-[color:color-mix(in_oklab,var(--accent-sky)_22%,transparent)]",
            )}
            required
          />

          <Button
            type="submit"
            className={cn(
              "w-full gap-2",
              isDialog ? "h-12 rounded-2xl text-sm shadow-[0_12px_26px_color-mix(in_oklab,var(--primary)_24%,transparent)] hover:-translate-y-0.5" : "py-2.5",
            )}
            disabled={isLoading}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {isLoading ? formCopy.submittingLabel : formCopy.submitLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className={cn("w-full border-t", isDialog ? "border-[var(--reader-border)]" : "border-[var(--border)]")} />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span
              className={cn(
                "px-3 text-[var(--muted)]",
                isDialog ? "bg-[var(--reader-panel)] text-[var(--text-muted)]" : "bg-[var(--surface)]",
              )}
            >
              或
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full gap-2",
            isDialog
              ? "h-12 rounded-2xl border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--reader-panel-elevated)_42%,transparent)] text-sm hover:border-[var(--reader-border-strong)] hover:bg-[color:color-mix(in_oklab,var(--accent-sky)_12%,var(--reader-panel-elevated))]"
              : "py-2.5",
          )}
          onClick={() => signIn("github", { callbackUrl: oauthCallbackUrl })}
        >
          {isDialog ? <Github className="h-4 w-4" aria-hidden="true" /> : null}
          {formCopy.githubLabel}
        </Button>

        <div
          className={cn(
            "mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm",
            isDialog
              ? "border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--accent-warm)_8%,transparent)] text-[var(--text-body)]"
              : "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--muted)]",
          )}
        >
          <KeyRound
            className={cn("mt-0.5 h-4 w-4 shrink-0", isDialog ? "text-[var(--accent-warm)]" : "text-[var(--brand)]")}
            aria-hidden="true"
          />
          <p>
            {formCopy.registerPrompt}{" "}
            <Link href="/register" className={cn("font-medium", isDialog ? "reader-link" : "ui-link")}>
              {formCopy.registerLinkLabel}
            </Link>
            {formCopy.registerSuffix}
          </p>
        </div>
      </div>
    </div>
  );
}
