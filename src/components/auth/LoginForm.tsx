"use client";

import type { Session } from "next-auth";
import { getSession, signIn } from "next-auth/react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";

import { AuthDivider, AuthErrorBanner, AuthHeader, SubmitLabel } from "@/components/auth/AuthFormParts";
import { Input } from "@/components/ui";
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
  emailPlaceholder: string;
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
    emailPlaceholder: "admin@example.com",
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
    emailPlaceholder: "you@example.com",
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

/**
 * 登录表单（简报第 12 节，原型 12 的登录弹层与状态画板 B / C）。
 * - dialog：读者登录，外层纸面由 LoginDialog 提供；
 * - page：后台登录，自带一张 card-bg 纸面，文案换成「后台登录」「进入后台」。
 */
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
  const bannerMessage = submitError || helperMessage;

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
      data-login-mode={mode}
      className={cn(
        isDialog
          ? "px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7"
          : "rounded-[var(--radius-paper)] border border-[var(--reader-border-strong)] bg-[var(--card-bg)] px-5 pb-6 pt-6 text-[var(--text-body)] sm:px-8 sm:pb-8 sm:pt-7",
      )}
    >
      <AuthHeader
        className={isDialog ? "pr-10" : undefined}
        description={formCopy.description}
        eyebrow={formCopy.eyebrow}
        title={formCopy.title}
      />

      <div className="mt-5">
        <AuthErrorBanner message={bannerMessage} />

        <form onSubmit={handleSubmit(handleCredentialsLogin)} className="flex flex-col gap-4" noValidate aria-busy={isSubmitting}>
          <Input
            type="email"
            label="邮箱"
            placeholder={formCopy.emailPlaceholder}
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            type="password"
            label="密码"
            placeholder="输入账号密码"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />

          <div className="mt-1">
            <button type="submit" className="ed-btn ed-btn--block" disabled={isSubmitting}>
              <SubmitLabel busyLabel={formCopy.submittingLabel} idleLabel={formCopy.submitLabel} submitting={isSubmitting} />
            </button>
          </div>
        </form>

        <AuthDivider />

        <button
          type="button"
          className="ed-btn-outline ed-btn--block"
          onClick={() => signIn("github", { callbackUrl: oauthCallbackUrl })}
        >
          {formCopy.githubLabel}
        </button>

        <p className="mt-5 text-[0.875rem] leading-[1.7] text-[var(--text-muted)]">
          {formCopy.registerPrompt}
          <Link href="/register" className="ed-link ed-link--inline">
            {formCopy.registerLinkLabel}
          </Link>
          {formCopy.registerSuffix}
        </p>
      </div>
    </div>
  );
}
