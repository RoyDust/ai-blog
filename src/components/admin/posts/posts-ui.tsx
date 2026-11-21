"use client";

/**
 * 后台文章列表的展示组件与纯函数助手。
 * 与数据层 hook（usePostsList）分离，便于页面壳组装与复用。
 */

import { type ReactNode } from "react";
import { Clock3, Loader2, CheckCircle2, Bot, Sparkles, XCircle, type LucideIcon } from "lucide-react";

import { Badge } from "@/components/shadcn/ui/badge";
import { Button } from "@/components/shadcn/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PostSummaryStatus } from "@/lib/post-summary-status";
import type { PostRow } from "./hooks/usePostsList";

export const placeholder = "-";

export type Tone = "cyan" | "emerald" | "amber" | "rose" | "slate" | "blue";

export const toneClassName: Record<Tone, string> = {
  cyan: "border-[color-mix(in_oklab,var(--brand)_22%,var(--border))] bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]",
  emerald: "border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success-foreground)]",
  amber: "border-[var(--warning-border)] bg-[var(--warning-surface)] text-[var(--warning-foreground)]",
  rose: "border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger-foreground)]",
  slate: "border-[var(--border)] bg-[var(--surface-alt)] text-[var(--text-body)]",
  blue: "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)]",
};

export function fallbackText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : placeholder;
}

export function formatNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString("zh-CN")
    : placeholder;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return placeholder;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return placeholder;
  return date.toLocaleDateString("zh-CN");
}

export function getSummaryMeta(status: PostSummaryStatus): { label: string; tone: Tone; icon: LucideIcon } {
  if (status === "QUEUED") return { label: "排队中", tone: "amber", icon: Clock3 };
  if (status === "GENERATING") return { label: "生成中", tone: "cyan", icon: Loader2 };
  if (status === "FAILED") return { label: "失败", tone: "rose", icon: XCircle };
  if (status === "GENERATED") return { label: "已生成", tone: "emerald", icon: Sparkles };
  return { label: "未生成", tone: "slate", icon: Bot };
}

export function getPreviewHref(row: PostRow) {
  const slug = row.slug?.trim();
  if (!slug) return null;
  return row.published ? `/posts/${slug}` : `/admin/posts/preview/${slug}`;
}

export function StatusPill({ tone, children, icon: Icon }: { tone: Tone; children: ReactNode; icon?: LucideIcon }) {
  return (
    <Badge variant="outline" className={cn("h-6 rounded-md px-2 font-medium", toneClassName[tone])}>
      {Icon ? <Icon className={cn("size-3", Icon === Loader2 && "animate-spin")} /> : null}
      {children}
    </Badge>
  );
}

export function PublishToggleTag({
  busy,
  onRequestTogglePublish,
  published,
}: {
  busy: boolean;
  onRequestTogglePublish: () => void;
  published: boolean;
}) {
  const Icon = busy ? Loader2 : published ? CheckCircle2 : Clock3;

  return (
    <Button
      aria-label={published ? "切换为草稿" : "切换为已发布"}
      className={cn(
        "h-7 gap-1 rounded-md border px-2 text-xs font-medium shadow-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1",
        toneClassName[published ? "emerald" : "amber"],
        published
          ? "hover:!border-[var(--success-border)] hover:!bg-[var(--success-surface)] hover:!text-[var(--success-foreground)]"
          : "hover:!border-[var(--warning-border)] hover:!bg-[var(--warning-surface)] hover:!text-[var(--warning-foreground)]",
      )}
      disabled={busy}
      onClick={onRequestTogglePublish}
      size="xs"
      type="button"
      variant="outline"
    >
      <Icon className={cn("size-3.5", busy && "animate-spin")} />
      <span>{published ? "已发布" : "草稿"}</span>
      <span className="text-current/45">/</span>
      <span>{published ? "转草稿" : "发布"}</span>
    </Button>
  );
}

export function MetricCard({
  active,
  icon: Icon,
  label,
  value,
  caption,
  onClick,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: Tone;
  caption: string;
  onClick?: () => void;
}) {
  const valueText = typeof value === "number" ? formatNumber(value) : value;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      title={caption}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs transition-colors",
        "border-[var(--border)] bg-[var(--surface-alt)]/75 text-[var(--text-muted)]",
        onClick && "cursor-pointer hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
        active && "border-[color-mix(in_oklab,var(--brand)_26%,var(--border))] bg-[var(--btn-regular-bg)] text-[var(--btn-content)] font-semibold",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden="true" />
      <span>{label}</span>
      <span className="font-mono font-semibold tabular-nums text-[var(--foreground)]">{valueText}</span>
    </div>
  );
}

export function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-pressed={active}
      className={cn(
        "h-7 shrink-0 whitespace-nowrap rounded-md border-0 px-2.5 text-xs shadow-none",
        active
          ? "!bg-[var(--surface)] !font-semibold !text-[var(--foreground)] !shadow-xs"
          : "!bg-transparent !font-medium !text-[var(--text-muted)] hover:!text-[var(--foreground)]",
      )}
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

export function IconAction({
  children,
  label,
}: {
  children: React.ReactElement;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}
