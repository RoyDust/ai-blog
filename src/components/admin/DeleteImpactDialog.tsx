"use client";

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@/components/admin/ui";

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
    <AlertDialog open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <p className="text-xs uppercase tracking-[0.18em] text-rose-500">危险操作</p>
          <AlertDialogTitle className="mt-2">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 px-6 py-5">
          {impacts.map((impact) => (
            <div key={impact.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <p className="text-sm text-[var(--foreground)]">
                {impact.label}
                <span className="ml-1 font-semibold">
                  {impact.value}
                  {impact.unit ?? ""}
                </span>
              </p>
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogClose render={<Button type="button" variant="outline" />}>
            {cancelLabel}
          </AlertDialogClose>
          <Button
            disabled={submitting}
            type="button"
            variant="danger"
            onClick={(event) => {
              event.preventDefault();
              void onConfirm();
            }}
          >
            {submitting ? "处理中..." : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
