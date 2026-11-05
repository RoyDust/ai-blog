"use client";

import type { ComponentProps, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { SkeletonBar, editorialEase } from "@/components/editorial";
import { TableCell, TableRow } from "@/components/shadcn/ui/table";
import { cn } from "@/lib/cn";

/** 数据行：行间 1px 细线，悬停 foreground 3% 底，勾选 focus 7% 底（同 kit TableRow），挂载时淡入 */
export const listRowClassName =
  "border-b border-[var(--border)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] data-[state=selected]:bg-[color-mix(in_oklab,var(--focus)_7%,transparent)]";

export function MotionTableRow({
  selected,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof motion.tr>, "children"> & { selected?: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.tr
      animate={{ opacity: 1 }}
      className={cn(listRowClassName, className)}
      data-slot="table-row"
      data-state={selected ? "selected" : undefined}
      exit={reduce ? undefined : { opacity: 0 }}
      initial={reduce ? false : { opacity: 0 }}
      transition={{ duration: 0.2, ease: editorialEase }}
      {...props}
    >
      {children}
    </motion.tr>
  );
}

/**
 * 加载骨架（方向 A 第 17.3 节）：保留表头，每格一根与真实行同高的灰条，行间照画 1px 细线。
 * bars 按列给出灰条宽度类名（null 表示空格），checkbox 列传 "checkbox"。
 */
export function SkeletonTableRows({
  bars,
  rows = 6,
  rowHeightClassName = "h-11",
}: {
  bars: Array<string | null>;
  rows?: number;
  rowHeightClassName?: string;
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} aria-hidden="true" className="hover:bg-transparent">
          {bars.map((bar, cellIndex) => (
            <TableCell key={cellIndex} className={cn(rowHeightClassName, "py-0")}>
              {bar === "checkbox" ? <SkeletonBar className="size-4" /> : bar ? <SkeletonBar className={cn("h-3", bar)} /> : null}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** 表格内的整行状态（空列表 / 加载失败）：左对齐，不套容器 */
export function TableStateRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="border-0 hover:bg-transparent">
      <TableCell className="h-auto py-0 whitespace-normal" colSpan={colSpan}>
        {children}
      </TableCell>
    </TableRow>
  );
}

/**
 * 工具栏右侧的批量操作位（方向 A 状态画板 A）：未勾选时一行 muted 提示，
 * 勾选后换成「已选 N」+ 描边批量按钮（破坏性的用 danger 描边），两态之间淡入平移切换。
 */
export function SelectionSwap({
  count,
  idle,
  children,
  label = "批量操作",
}: {
  count: number;
  idle?: ReactNode;
  children: ReactNode;
  label?: string;
}) {
  const reduce = useReducedMotion();
  const hasSelection = count > 0;
  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: 4 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -4 },
        transition: { duration: 0.18, ease: editorialEase },
      };

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {hasSelection ? (
        <motion.div
          key="bulk"
          aria-label={label}
          className="flex flex-wrap items-center gap-2"
          data-slot="admin-bulk-bar"
          role="group"
          {...motionProps}
        >
          <span className="mr-1 text-[0.8125rem] text-[var(--text-muted)]">
            已选 <span className="font-mono font-bold text-[var(--foreground)] tabular-nums">{count}</span>
          </span>
          {children}
        </motion.div>
      ) : idle ? (
        <motion.span key="idle" className="text-[0.8125rem] text-[var(--text-muted)]" {...motionProps}>
          {idle}
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

/** 加载态给读屏的提示 */
export function LoadingStatus({ label }: { label: string }) {
  return (
    <span className="ed-visually-hidden" role="status">
      {label}
    </span>
  );
}
