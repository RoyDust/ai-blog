"use client";

/**
 * 后台工作台类页面（方向 A 第 15 节）的小积木：文章编辑、AI 日报、设置、模型配置等共用。
 *
 * - FieldLabel：标签在上，必填写 muted 灰「*」（aria-hidden，不进可访问名称），可选写「（可选）」
 * - AiTextButton：字段级 AI 动作——等宽「AI」文字按钮（info 色，28px），放在输入框右侧并用 1px 竖线隔开，
 *   或放在标签行右侧；loading 时换成静态转圈并 aria-busy
 * - RadioChoiceGroup：二选一 / 多选一的单选组（原生 radio，方向键切换）
 * - FadeBanner：请求级 banner（左 2px 语气色线 + 8% 底），出现 / 消失淡入淡出
 * - InlineSpinner：静态转圈（reduced motion 时不转）
 * - HintTooltip：禁用按钮的提示（禁用按钮收不到指针事件，挂在外层包裹上）
 */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { editorialEase } from "@/components/editorial";
import { cn } from "@/lib/cn";

/* ── 标签 ───────────────────────────────────────────────────────── */

export function FieldLabel({
  children,
  htmlFor,
  id,
  required = false,
  optional = false,
  className,
  as = "label",
}: {
  children: ReactNode;
  htmlFor?: string;
  id?: string;
  required?: boolean;
  optional?: boolean;
  className?: string;
  as?: "label" | "span" | "p";
}) {
  const Tag = as;
  // 「*」与「（可选）」放在 <label> 外面：不改变 label 文本（getByLabel("标题", { exact: true }) 等仍然命中）
  return (
    <span className={cn("inline-flex items-baseline text-[0.8125rem] leading-[1.4] font-bold text-[var(--foreground)]", className)}>
      <Tag htmlFor={as === "label" ? htmlFor : undefined} id={id}>
        {children}
      </Tag>
      {required ? (
        <span aria-hidden="true" className="ml-1 font-medium text-[var(--text-muted)]">
          *
        </span>
      ) : null}
      {optional ? <span className="ml-1 font-medium text-[var(--text-muted)]">（可选）</span> : null}
    </span>
  );
}

/* ── 带前后缀的输入框 ───────────────────────────────────────────── */

type FramedInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> & {
  /** 框内左侧等宽前缀（如 Slug 的「/posts/」），aria-hidden */
  prefix?: ReactNode;
  /** 框内右侧后缀（单位「MB」或 AI 按钮） */
  suffix?: ReactNode;
  /** md 36px（默认）/ lg 44px（文章标题） */
  size?: "md" | "lg";
  invalid?: boolean;
  inputClassName?: string;
};

/**
 * 输入框外框承担描边与 focus 环（:focus-within），前后缀与输入同在一个 1px 框里。
 */
export function FramedInput({ prefix, suffix, size = "md", invalid = false, className, inputClassName, ...props }: FramedInputProps) {
  return (
    <div
      data-slot="framed-input"
      data-invalid={invalid ? "true" : undefined}
      className={cn(
        "flex w-full min-w-0 items-center rounded-[var(--radius-ctl)] border border-[var(--reader-border-strong)] pr-1 pl-2.5 transition-[border-color] duration-150 hover:border-[var(--text-muted)] has-[input:focus-visible]:border-[var(--foreground)] has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus)] has-[input:disabled]:opacity-55",
        size === "lg" ? "h-11" : "h-9",
        invalid && "border-[var(--danger-foreground)] hover:border-[var(--danger-foreground)]",
        className,
      )}
    >
      {prefix ? (
        <span aria-hidden="true" className="shrink-0 font-mono text-[0.8125rem] text-[var(--text-muted)]">
          {prefix}
        </span>
      ) : null}
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] focus-visible:outline-none disabled:cursor-not-allowed md:text-sm",
          inputClassName,
        )}
        {...props}
      />
      {suffix ? <span className="ml-2 flex shrink-0 items-center">{suffix}</span> : null}
    </div>
  );
}

/* ── 转圈 ───────────────────────────────────────────────────────── */

export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-3 shrink-0 rounded-full border-[1.5px] border-current border-t-transparent animate-spin motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/* ── 字段 AI 按钮 ───────────────────────────────────────────────── */

export function AiTextButton({
  label,
  loading = false,
  disabled = false,
  onClick,
  separated = false,
  className,
}: {
  /** aria-label / title，沿用现状文案（如「AI 补全标题」） */
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  /** 放在输入框内右侧时，左侧加 1px 竖线 */
  separated?: boolean;
  className?: string;
}) {
  const button = (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={loading || undefined}
      data-loading={loading ? "true" : undefined}
      className={cn(
        "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-[2px] px-2 font-mono text-xs font-bold tracking-[0.04em] text-[var(--focus)] transition-[background-color,opacity] duration-150 hover:bg-[color-mix(in_oklab,var(--focus)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent data-[loading=true]:opacity-70",
        className,
      )}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <InlineSpinner className="size-2.5" /> : null}
      <span>AI</span>
    </button>
  );

  if (!separated) return button;

  return (
    <span className="flex shrink-0 items-center gap-1">
      <span aria-hidden="true" className="h-[18px] w-px bg-[var(--border)]" />
      {button}
    </span>
  );
}

/* ── 单选组 ─────────────────────────────────────────────────────── */

export type RadioChoice<T extends string> = { value: T; label: string };

export function RadioChoiceGroup<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  description,
  disabled = false,
  className,
}: {
  label: string;
  name: string;
  value: T;
  options: RadioChoice<T>[];
  onChange: (value: T) => void;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const descriptionId = description ? `${baseId}-desc` : undefined;

  return (
    <div
      role="radiogroup"
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      className={className}
      data-slot="radio-choice-group"
    >
      <div id={labelId} className="mb-0.5 text-[0.8125rem] leading-[1.4] font-bold text-[var(--foreground)]">
        {label}
      </div>
      <div className="flex flex-wrap gap-x-6">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "inline-flex min-h-7 cursor-pointer items-center gap-2 text-sm transition-colors duration-150",
                checked ? "text-[var(--foreground)]" : "text-[var(--text-body)] hover:text-[var(--foreground)]",
                disabled && "cursor-not-allowed opacity-55",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(option.value)}
                className="grid size-4 shrink-0 cursor-pointer appearance-none place-content-center rounded-full border border-[var(--reader-border-strong)] transition-colors duration-150 before:size-2 before:scale-0 before:rounded-full before:bg-[var(--foreground)] before:transition-transform before:duration-150 before:content-[''] checked:border-[var(--foreground)] checked:before:scale-100 hover:border-[var(--text-muted)] checked:hover:border-[var(--foreground)] disabled:cursor-not-allowed motion-reduce:before:transition-none"
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
      {description ? (
        <p id={descriptionId} className="mt-1.5 text-xs leading-[1.55] text-[var(--text-muted)]">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/* ── banner ─────────────────────────────────────────────────────── */

export type BannerTone = "danger" | "success" | "warning" | "info" | "neutral";

const bannerToneClassNames: Record<BannerTone, string> = {
  danger: "ed-banner ed-banner--danger",
  success: "ed-banner ed-banner--success",
  warning: "ed-banner ed-banner--warning",
  info: "ed-banner ed-banner--info",
  neutral: "ed-banner",
};

/**
 * 请求级 banner。message 为空时淡出；danger 用 role="alert"，其余 role="status"。
 */
export function FadeBanner({
  message,
  tone = "danger",
  className,
  children,
}: {
  message?: ReactNode;
  tone?: BannerTone;
  className?: string;
  children?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const visible = Boolean(message);

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.div
          key={`${tone}`}
          role={tone === "danger" ? "alert" : "status"}
          className={cn(bannerToneClassNames[tone], className)}
          data-slot="workspace-banner"
          data-tone={tone}
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.24, ease: editorialEase } }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.16 } }}
        >
          {message}
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* ── 禁用按钮提示 ───────────────────────────────────────────────── */

export function HintTooltip({ hint, children, className }: { hint: string; children: ReactNode; className?: string }) {
  const tooltipId = useId();

  return (
    <span
      className={cn("group/hint relative inline-flex", className)}
      tabIndex={0}
      aria-describedby={tooltipId}
    >
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 -translate-x-1/2 translate-y-1 rounded-[4px] bg-[var(--foreground)] px-2 py-1 text-xs font-bold whitespace-nowrap text-[var(--card-bg)] opacity-0 transition-[opacity,transform] duration-150 group-hover/hint:translate-y-0 group-hover/hint:opacity-100 group-focus-visible/hint:translate-y-0 group-focus-visible/hint:opacity-100 motion-reduce:transition-none"
      >
        {hint}
      </span>
    </span>
  );
}
