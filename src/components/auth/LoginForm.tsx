"use client";

import type { Session } from "next-auth";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
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
  "Too many requests": "登录尝试过于频繁，请一分钟后重试。",
  "Invalid credentials": "邮箱或密码错误，请重试。",
  "not-admin": "当前不是管理员账号，请切换到拥有后台权限的账号。",
  "auth-secret-missing": "认证服务配置异常，请联系管理员。",
  OAuthAccountNotLinked: "该邮箱已注册，请先使用邮箱密码登录，然后在设置页绑定 GitHub。",
  GitHubEmailRequired: "GitHub 未返回可用邮箱，请在 GitHub 账号中添加并验证邮箱后重试。",
  Configuration: "GitHub 登录暂未正确配置，请联系管理员。",
  OAuthSignin: "发起 GitHub 登录时出错，请重试；若持续失败请联系管理员。",
  OAuthCallback: "GitHub 登录回调校验失败，请重试；若持续失败请联系管理员。",
  OAuthCreateAccount: "创建 GitHub 账号时出错，请重试。",
  EmailCreateAccount: "创建账号时出错，请重试。",
  Callback: "登录回调处理失败，请重试。",
  EmailSignin: "邮箱登录链接无效或已过期，请重新发起登录。",
  CredentialsSignin: "邮箱或密码错误，请重试。",
  SessionRequired: "登录状态已失效，请重新登录。",
  AccessDenied: "登录被拒绝，请检查账号权限。",
  Verification: "验证链接无效或已过期，请重新发起。",
  Default: "登录失败，请稍后重试。",
};

const loginSchema = z.object({
  email: z.string().trim().email("请输入有效的邮箱地址"),
  password: z.string().min(1, "请输入密码"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [submitError, setSubmitError] = useState("");
  const helperMessage = authError ? errorMessages[authError] ?? "登录失败，请稍后重试。" : "";
  const isDialog = mode === "dialog";
  const HeaderIcon = isDialog ? Sparkles : ShieldCheck;

  const handleCredentialsLogin = async (values: LoginFormValues) => {
    setSubmitError("");

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setSubmitError(errorMessages[result.error] ?? result.error);
        return;
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

      window.location.assign(getPostLoginRedirect(session?.user?.role, callbackUrl));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "登录失败，请稍后重试");
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border p-6 sm:p-7",
        isDialog
          ? "reader-panel border-[var(--reader-border)] bg-[var(--reader-panel)] shadow-[var(--reader-shadow)] backdrop-blur-xl"
          : "card-base ui-surface border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      <div className={cn("mb-5 flex items-start justify-between gap-4", isDialog ? "pr-9" : "")}>
        <div className="min-w-0 space-y-1.5">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--btn-regular-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--btn-content)]">
            <HeaderIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {formCopy.eyebrow}
          </span>
          <h1
            className={cn(
              "font-display font-bold leading-snug tracking-tight text-[var(--foreground)]",
              isDialog ? "text-xl sm:text-2xl" : "text-2xl",
            )}
          >
            {formCopy.title}
          </h1>
          <p className={cn("max-w-sm text-sm leading-6", isDialog ? "text-[var(--text-body)]" : "text-[var(--muted)]")}>
            {formCopy.description}
          </p>
        </div>
      </div>

      <div>
        {submitError ? (
          <div className="ui-alert-danger mb-4 rounded-xl px-3.5 py-2.5">
            <p className="text-xs font-medium leading-5">{submitError}</p>
          </div>
        ) : null}

        {!submitError && helperMessage ? (
          <div className="ui-alert-danger mb-4 rounded-xl px-3.5 py-2.5">
            <p className="text-xs font-medium leading-5">{helperMessage}</p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit(handleCredentialsLogin)} className="space-y-3.5" noValidate>
          <Input
            type="email"
            label="邮箱"
            placeholder="admin@example.com"
            autoComplete="email"
            error={errors.email?.message}
            leftSlot={<Mail className="h-4 w-4" aria-hidden="true" />}
            className={cn(
              "h-10 rounded-xl text-sm",
              isDialog
                ? "border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] placeholder:text-[var(--text-muted)]"
                : "border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_50%,var(--surface)_50%)]",
            )}
            {...register("email")}
          />

          <Input
            type="password"
            label="密码"
            placeholder="输入账号密码"
            autoComplete="current-password"
            error={errors.password?.message}
            leftSlot={<KeyRound className="h-4 w-4" aria-hidden="true" />}
            className={cn(
              "h-10 rounded-xl text-sm",
              isDialog
                ? "border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,var(--card-bg)_48%)] placeholder:text-[var(--text-muted)]"
                : "border-[var(--border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_50%,var(--surface)_50%)]",
            )}
            {...register("password")}
          />

          <Button
            type="submit"
            className="h-10 w-full gap-2 rounded-xl text-sm"
            disabled={isSubmitting}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {isSubmitting ? formCopy.submittingLabel : formCopy.submitLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className={cn("w-full border-t", isDialog ? "border-[var(--line-color)]" : "border-[var(--border)]")} />
          </div>
          <div className="relative flex justify-center text-xs">
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
            "h-10 w-full gap-2 rounded-xl text-sm",
            isDialog &&
              "border-[var(--reader-border)] bg-[color:color-mix(in_oklab,var(--surface-alt)_42%,transparent)] hover:bg-[var(--btn-plain-bg-hover)]",
          )}
          onClick={() => signIn("github", { callbackUrl: oauthCallbackUrl })}
        >
          <Github className="h-4 w-4" aria-hidden="true" />
          {formCopy.githubLabel}
        </Button>

        <p className={cn("mt-5 text-center text-xs leading-5", isDialog ? "text-[var(--text-muted)]" : "text-[var(--muted)]")}>
          {formCopy.registerPrompt}{" "}
          <Link href="/register" className={cn("font-semibold", isDialog ? "reader-link" : "ui-link")}>
            {formCopy.registerLinkLabel}
          </Link>
          {formCopy.registerSuffix}
        </p>
      </div>
    </div>
  );
}
