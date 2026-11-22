"use client";

import type { KeyboardEvent } from "react";

import { settingsTabs, type SettingsTabId } from "./settings-shared";

type SettingsTablistProps = {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
};

/**
 * 设置页顶部分类 tab 栏（roving tabindex 键盘导航）。
 * 纯展示组件：激活 tab 与切换动作全部经 props 上抛。
 */
export function SettingsTablist({ activeTab, onTabChange }: SettingsTablistProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (settingsTabs.length === 0) return;
    const currentIndex = settingsTabs.findIndex((tab) => tab.id === activeTab);
    if (currentIndex === -1) return;

    let nextIndex: number;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % settingsTabs.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + settingsTabs.length) % settingsTabs.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = settingsTabs.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextTab = settingsTabs[nextIndex];
    onTabChange(nextTab.id);
    document.getElementById(`settings-tab-${nextTab.id}`)?.focus();
  };

  return (
    <div className="overflow-x-auto pb-1">
      <div
        aria-label="设置分类"
        className="inline-flex min-w-full gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              aria-controls="settings-panel"
              aria-selected={isActive}
              className={`flex min-w-[150px] flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] ${
                isActive
                  ? "bg-[var(--surface-alt)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              }`}
              id={`settings-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{tab.label}</span>
                <span className="mt-0.5 block truncate text-xs opacity-75">{tab.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
