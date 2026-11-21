"use client";

import type { UseFormReturn } from "react-hook-form";

import { FramedInput } from "@/components/admin/workspace/WorkspaceKit";
import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { SettingsFieldItem, SettingsNote, SettingsSaveRow, SettingsSection } from "./SettingsFormParts";
import type { BlogSettingsFormValues } from "./settings-shared";

type ReadingSettingsPanelProps = {
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「阅读目标」设置面板：每月目标篇数（240px 数字框 + 后缀「篇」）。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function ReadingSettingsPanel({ blogForm, onSubmit }: ReadingSettingsPanelProps) {
  return (
    <SettingsSection title="阅读目标" description="前台登录用户侧栏会使用真实阅读记录，并按这里配置的目标计算本月进度。">
      <Form {...blogForm}>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <FormField
            control={blogForm.control}
            name="reading.monthlyGoal"
            render={({ field, fieldState }) => (
              <SettingsFieldItem
                label="每月目标篇数"
                required
                description="只影响目标值；已读篇数、阅读时长和连续阅读天数来自真实访问记录。"
              >
                <FormControl>
                  <FramedInput
                    className="w-60"
                    inputClassName="font-mono"
                    invalid={Boolean(fieldState.error)}
                    min={1}
                    max={999}
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(Number(event.target.value) || 1)}
                    step="1"
                    suffix={<span className="pr-1.5 text-[0.8125rem] text-[var(--text-muted)]">篇</span>}
                    type="number"
                    value={field.value}
                  />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <SettingsNote>未登录访客不会看到前台阅读统计和本月阅读目标。</SettingsNote>
          <SettingsSaveRow label="保存阅读目标" submitting={blogForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
