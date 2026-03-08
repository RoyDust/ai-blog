"use client";

import { Button } from "@/components/ui";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div
        aria-describedby="delete-impact-description"
        aria-labelledby="delete-impact-title"
        aria-modal="true"
        className="ui-surface relative w-full max-w-lg rounded-2xl border border-[var(--border)] shadow-2xl"
        role="alertdialog"
      >
        <div className="border-b border-[var(--border)] px-6 py-5">
          <p className="text-xs uppercase tracking-[0.18em] text-rose-500">Danger Zone</p>
          <h2 id="delete-impact-title" className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <p id="delete-impact-description" className="mt-2 text-sm text-[var(--muted)]">
            {description}
          </p>
        </div>

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

        <div className="flex justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            {cancelLabel}
          </Button>
          <Button disabled={submitting} onClick={() => void onConfirm()} type="button" variant="danger">
            {submitting ? "处理中..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
