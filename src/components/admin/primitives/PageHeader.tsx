import type { ReactNode } from "react";

interface PageHeaderProps {
  title: ReactNode;
  /** 一句说明（正文色 .875rem，最多两行） */
  description?: ReactNode;
  /** 右侧：本页唯一的实心主按钮（或描边按钮组） */
  action?: ReactNode;
  /** 中文 eyebrow（如「评论审核」「AI 助手」），也可以放「← 返回」文字链接 */
  eyebrow?: ReactNode;
  /** 等宽 meta 行：计数、日期、语气色状态与保存说明，多项用 · 连接 */
  meta?: ReactNode;
  /** 2px 粗线下方紧跟的内容 */
  children?: ReactNode;
  className?: string;
  titleId?: string;
}

/**
 * 后台页头（方向 A）：中文 eyebrow + 衬线 28px h1 + 可选说明 / 等宽 meta，右侧放主按钮，
 * 底部 2px foreground 粗线收尾。直接放在 AdminLayout 的纸面里，不再自带底色和内边距。
 */
export function PageHeader({ title, description, action, eyebrow, meta, children, className, titleId }: PageHeaderProps) {
  return (
    <header className={className} data-slot="admin-page-header">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b-2 border-[var(--foreground)] pb-3.5">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1">
          {eyebrow ? <div className="ed-eyebrow">{eyebrow}</div> : null}
          <h1 id={titleId} className="font-serif text-[1.75rem] leading-[1.2] font-bold text-balance text-[var(--foreground)]">
            {title}
          </h1>
          {description ? <p className="line-clamp-2 max-w-3xl text-sm leading-6 text-[var(--text-body)]">{description}</p> : null}
          {meta ? <div className="ed-mono flex flex-wrap items-baseline gap-x-1 text-[0.8125rem] text-[var(--text-muted)]">{meta}</div> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{action}</div> : null}
      </div>
      {children}
    </header>
  );
}
