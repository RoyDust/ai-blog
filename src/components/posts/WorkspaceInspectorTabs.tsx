"use client";

import { cn } from "@/lib/cn";

export type InspectorTab = "all" | "publish" | "metadata" | "checklist";

const INSPECTOR_TABS: Array<{ id: InspectorTab; label: string }> = [
  { id: "all", label: "全部" },
  { id: "publish", label: "发布" },
  { id: "metadata", label: "元信息" },
  { id: "checklist", label: "清单" },
];

export function WorkspaceInspectorTabs({
  value,
  onChange,
}: {
  value: InspectorTab;
  onChange: (next: InspectorTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="编辑器侧栏分组"
      className="sticky top-0 z-10 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/95 p-1 backdrop-blur-sm"
    >
      {INSPECTOR_TABS.map((tab) => {
        const active = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              "h-7 flex-1 rounded-lg px-2 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
