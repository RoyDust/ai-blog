"use client";

import type { KeyboardEvent } from "react";

import { ActiveUnderline } from "@/components/editorial";

import { settingsTabs, type SettingsTabId } from "./settings-shared";

type SettingsTablistProps = {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
};

/**
 * 设置页顶部分类 tab 栏（方向 A 第 15 节）：一行 7 格文字页签（名称 + 一行说明），格间 1px 细线，
 * 当前格 2px sky 下划线（layoutId 平移）；roving tabindex 键盘导航（左右 / Home / End）。
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
    <div className="overflow-x-auto">
      <div
        aria-label="设置分类"
        className="flex min-w-max border-b border-[var(--border)]"
        onKeyDown={handleKeyDown}
        role="tablist"
      >
        {settingsTabs.map((tab, index) => {
          const isActive = activeTab === tab.id;

          return (
            <button
              aria-controls="settings-panel"
              aria-selected={isActive}
              className={`group relative flex min-w-[8.5rem] flex-1 cursor-pointer flex-col items-start gap-0.5 px-3.5 pt-2.5 pb-3 text-left transition-colors duration-150 ${
                index > 0 ? "before:absolute before:top-2.5 before:bottom-3 before:left-0 before:w-px before:bg-[var(--border)] before:content-['']" : ""
              } ${isActive ? "text-[var(--foreground)]" : "text-[var(--text-muted)] hover:bg-[color-mix(in_oklab,var(--foreground)_3%,transparent)] hover:text-[var(--foreground)]"}`}
              id={`settings-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              <span className="block truncate text-sm font-bold">{tab.label}</span>
              <span className={`block truncate text-xs ${isActive ? "text-[var(--text-body)]" : "text-[var(--text-muted)]"}`}>{tab.description}</span>
              {isActive ? <ActiveUnderline layoutId="settings-tab-underline" className="ed-underline -bottom-px" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
