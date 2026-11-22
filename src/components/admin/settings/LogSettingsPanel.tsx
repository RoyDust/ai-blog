"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input } from "@/components/admin/ui";
import { Form, FormField, FormItem, FormMessage } from "@/components/shadcn/ui/form";
import type { LogSettingsFormValues, OperationLogSettings } from "./settings-shared";

type LogSettingsPanelProps = {
  logForm: UseFormReturn<LogSettingsFormValues>;
  logSettings: OperationLogSettings;
  usagePercent: number;
  onSubmit: () => void;
};

/**
 * 「日志策略」设置面板：容量上限与当前占用进度条。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function LogSettingsPanel({ logForm, logSettings, usagePercent, onSubmit }: LogSettingsPanelProps) {
  return (
    <WorkspacePanel title="日志设置" description="控制后台接口日志表的总占用，超过上限后优先清理最旧日志。">
      <Form {...logForm}>
        <form className="space-y-4" noValidate onSubmit={onSubmit}>
          <FormField
            control={logForm.control}
            name="maxStorageMb"
            render={({ field }) => (
              <FormItem>
                <Input
                  helperText="默认 10 MB。保存后会立即按新上限裁剪旧日志，保留最新记录。"
                  label="日志大小限制"
                  min={1}
                  max={512}
                  onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                  rightSlot={<span className="px-2 text-sm font-medium text-[var(--muted)]">MB</span>}
                  step="1"
                  type="number"
                  value={field.value}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-[var(--foreground)]">当前占用</span>
              <span className="text-[var(--muted)]">
                {logSettings.currentStorageLabel} / {logSettings.maxStorageMb} MB
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
              <div className="h-full rounded-full bg-[var(--brand)] transition-[width]" style={{ width: `${usagePercent}%` }} />
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">当前保留 {logSettings.rowCount} 条接口日志。</p>
          </div>

          <div className="flex justify-end">
            <Button disabled={logForm.formState.isSubmitting} type="submit">
              {logForm.formState.isSubmitting ? "保存中..." : "保存日志设置"}
            </Button>
          </div>
        </form>
      </Form>
    </WorkspacePanel>
  );
}
