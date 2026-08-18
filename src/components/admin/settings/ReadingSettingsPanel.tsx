"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input } from "@/components/admin/ui";
import { Form, FormField, FormItem, FormMessage } from "@/components/shadcn/ui/form";
import type { BlogSettingsFormValues } from "./settings-shared";

type ReadingSettingsPanelProps = {
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「阅读目标」设置面板：每月目标篇数。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function ReadingSettingsPanel({ blogForm, onSubmit }: ReadingSettingsPanelProps) {
  return (
    <Form {...blogForm}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <WorkspacePanel title="阅读目标" description="前台登录用户侧栏会使用真实阅读记录，并按这里配置的目标计算本月进度。">
          <div className="space-y-4">
            <FormField
              control={blogForm.control}
              name="reading.monthlyGoal"
              render={({ field }) => (
                <FormItem>
                  <Input
                    helperText="只影响目标值；已读篇数、阅读时长和连续阅读天数来自真实访问记录。"
                    label="每月目标篇数"
                    min={1}
                    max={999}
                    onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                    rightSlot={<span className="px-2 text-sm font-medium text-[var(--muted)]">篇</span>}
                    step="1"
                    type="number"
                    value={field.value}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
              未登录访客不会看到前台阅读统计和本月阅读目标。
            </div>
            <div className="flex justify-end">
              <Button disabled={blogForm.formState.isSubmitting} type="submit" variant="outline">
                {blogForm.formState.isSubmitting ? "保存中..." : "保存阅读目标"}
              </Button>
            </div>
          </div>
        </WorkspacePanel>
      </form>
    </Form>
  );
}
