"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { collapseMotion } from "@/components/editorial";
import { fieldErrorMotionClassName } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

/*
 * 账号表单的共用片段（登录弹层、后台登录、注册页），写法见简报第 12 节「全站表单写法」。
 */

/** 「或」分隔线：两侧 1px 细线，中间 muted 小字（登录与注册共用） */
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3 text-[0.8125rem] text-[var(--text-muted)]">
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
      或
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

/** 账号页头：eyebrow + 衬线 28px h1 + 一句说明，2px foreground 粗线收尾（登录弹层、后台登录、注册共用） */
export function AuthHeader({
  eyebrow,
  title,
  description,
  titleId,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  titleId?: string;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-1.5 border-b-2 border-[var(--foreground)] pb-4", className)}>
      <p className="ed-eyebrow">{eyebrow}</p>
      <h1 id={titleId} className="ed-serif text-[1.625rem] leading-[1.2] text-[var(--foreground)] sm:text-[1.75rem]">
        {title}
      </h1>
      {description ? <p className="mt-0.5 text-[0.875rem] leading-[1.7] text-[var(--text-body)]">{description}</p> : null}
    </header>
  );
}

/** 请求级错误 banner：表单顶部，左 2px danger 竖线 + 8% 底，出现 / 消失时高度过渡 */
export function AuthErrorBanner({ message }: { message: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {message ? (
        <motion.div
          key="auth-error-banner"
          className="overflow-hidden"
          {...(reduceMotion ? {} : collapseMotion)}
        >
          <div className="pb-4">
            <p className="ed-banner ed-banner--danger" role="alert">
              {message}
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** 提交按钮文字：状态切换时新文字淡入（换 key 触发入场） */
export function SubmitLabel({ submitting, idleLabel, busyLabel }: { submitting: boolean; idleLabel: string; busyLabel: string }) {
  return (
    <span key={submitting ? "busy" : "idle"} className={fieldErrorMotionClassName}>
      {submitting ? busyLabel : idleLabel}
    </span>
  );
}
