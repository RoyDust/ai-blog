"use client";

import { useRef, type ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

export type ConfirmDialogTone = "default" | "danger";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  submitting?: boolean;
  /** 可选影响说明区：批量/危险操作的计数、对象列表等。 */
  impacts?: ReactNode;
  onConfirm: () => void | Promise<void>;
}

/**
 * 后台通用确认弹窗（基于既有 AlertDialog 封装）。
 *
 * 统一承载发布、清日志、重生成日报、解绑 GitHub、归档封面等确认场景：
 * - tone=danger 时确认按钮使用危险色，其余默认主色
 * - submitting 时确认/取消按钮禁用，确认按钮显示「处理中...」
 * - impacts 渲染在标题描述与底部按钮之间
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认",
  cancelLabel = "取消",
  tone = "default",
  submitting = false,
  impacts,
  onConfirm,
}: ConfirmDialogProps) {
  // 同步互斥：阻止同一事件循环内的快速双击重复触发 onConfirm（submitting 依赖重渲染，防不住双击）
  const confirmLockRef = useRef(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {impacts ? (
          <div className="space-y-3 px-6 py-4 text-sm leading-6 text-[var(--foreground)]">
            {impacts}
          </div>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button disabled={submitting} type="button" variant="outline">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={(event) => {
              event.preventDefault();
              if (confirmLockRef.current) {
                return;
              }
              confirmLockRef.current = true;
              void Promise.resolve(onConfirm()).finally(() => {
                confirmLockRef.current = false;
              });
            }}
          >
            <Button disabled={submitting} type="button" variant={tone === "danger" ? "danger" : "primary"}>
              {submitting ? "处理中..." : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
