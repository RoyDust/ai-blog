"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/admin/ui";
import { DangerEyebrow } from "@/components/admin/ui/confirm-dialog";

export interface DeleteImpactItem {
  label: string;
  value: number;
  unit?: string;
}

interface DeleteImpactDialogProps {
  open: boolean;
  title: string;
  description: string;
  impacts: DeleteImpactItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  submitting?: boolean;
  onConfirm: () => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
}

export function DeleteImpactDialog({
  open,
  title,
  description,
  impacts,
  confirmLabel = "确认隐藏",
  cancelLabel = "取消",
  submitting = false,
  onConfirm,
  onOpenChange,
}: DeleteImpactDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <DangerEyebrow />
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {/* 影响范围：细线分隔的行，数字等宽 */}
        <dl className="border-y border-[var(--border)] text-sm">
          {impacts.map((impact) => (
            <div key={impact.label} className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] py-2.5 last:border-b-0">
              <dt className="text-[var(--text-body)]">{impact.label}</dt>
              <dd className="shrink-0 text-[var(--foreground)]">
                <span className="ed-mono font-bold">{impact.value}</span>
                {impact.unit ? <span className="ml-1 text-xs text-[var(--text-muted)]">{impact.unit}</span> : null}
              </dd>
            </div>
          ))}
        </dl>

        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button type="button" variant="outline">
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction
            asChild
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            <Button disabled={submitting} type="button" variant="danger">
              {submitting ? "处理中..." : confirmLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
