/**
 * 后台方向 A 的共享类名（给不方便用组件的地方直接拼 className）。
 *
 * - adminIconButtonClassName：36px 透明图标按钮（顶栏、标签栏用 size-8 收到 32px）
 * - adminTextActionClassName / adminTextActionDangerClassName：行内下划线文字按钮（批准、编辑、删除），不带箭头
 * - adminTabClassName：文字 tab（32px），当前项 foreground，配 <ActiveUnderline layoutId=… /> 做 2px sky 下划线
 * - adminMetricValueClassName / adminMetricUnitClassName：等宽指标值 + 无衬线 muted 单位
 * - adminHairlineRowClassName：细线列表行（行间 1px 细线，悬停 foreground 4% 底）
 */
export const adminIconButtonClassName =
  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-ctl)] text-[var(--text-body)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] hover:text-[var(--foreground)] aria-expanded:bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] aria-expanded:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40";

export const adminTextActionClassName =
  "inline-flex min-h-8 cursor-pointer items-center text-[0.8125rem] font-bold text-[var(--text-body)] underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4 transition-[color,text-decoration-color] duration-150 hover:text-[var(--foreground)] hover:decoration-[var(--accent-sky)] disabled:cursor-not-allowed disabled:opacity-45";

export const adminTextActionDangerClassName =
  "inline-flex min-h-8 cursor-pointer items-center text-[0.8125rem] font-bold text-[var(--danger-foreground)] underline decoration-[color-mix(in_oklab,var(--danger-foreground)_45%,transparent)] decoration-1 underline-offset-4 transition-[text-decoration-color] duration-150 hover:decoration-[var(--danger-foreground)] disabled:cursor-not-allowed disabled:opacity-45";

export const adminTabClassName =
  "relative inline-flex h-8 cursor-pointer items-center px-2 text-[0.8125rem] font-bold whitespace-nowrap text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--foreground)] aria-pressed:text-[var(--foreground)] aria-selected:text-[var(--foreground)] aria-[current=page]:text-[var(--foreground)] data-[active=true]:text-[var(--foreground)]";

export const adminMetricValueClassName = "font-mono font-bold tabular-nums text-[var(--foreground)]";

export const adminMetricUnitClassName = "text-[0.875rem] font-medium text-[var(--text-muted)]";

// 悬停底色向两侧多铺 8px，底部细线仍与内容对齐（细线画在 ::before 上）
export const adminHairlineRowClassName =
  "relative -mx-2 rounded-[2px] px-2 transition-colors duration-150 before:pointer-events-none before:absolute before:inset-x-2 before:bottom-0 before:h-px before:bg-[var(--border)] before:content-[''] hover:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]";
