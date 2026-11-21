"use client";

import type { UseFormReturn } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { SettingsFieldItem, SettingsSaveRow, SettingsSection, settingsMonoInputClassName } from "./SettingsFormParts";
import type { BlogSettingsFormValues } from "./settings-shared";

type NewsletterSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「邮件订阅」设置面板：订阅开关、发送器与收发邮箱。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function NewsletterSettingsPanel({ blogDraft, blogForm, onSubmit }: NewsletterSettingsPanelProps) {
  return (
    <SettingsSection title="邮件订阅" description="控制前台 Newsletter 订阅基础开关和本地日志发送器。">
      <Form {...blogForm}>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              checked={blogDraft.newsletter.enabled}
              className="ed-checkbox mt-0.5"
              onChange={(event) => blogForm.setValue("newsletter.enabled", event.target.checked, { shouldDirty: true, shouldValidate: true })}
              type="checkbox"
            />
            <span>
              <span className="block text-[0.8125rem] font-bold text-[var(--foreground)]">启用订阅入口</span>
              <span className="mt-0.5 block text-xs text-[var(--text-muted)]">首页和文章页会读取此开关展示订阅入口。</span>
            </span>
          </label>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <FormField
              control={blogForm.control}
              name="newsletter.provider"
              render={({ field }) => (
                <SettingsFieldItem label="发送器" description="当前只支持 none 和 log；真实邮件供应商会在后续批次接入。">
                  <FormControl>
                    <Input
                      className={settingsMonoInputClassName}
                      name={field.name}
                      onBlur={field.onBlur}
                      onChange={(event) => field.onChange(event.target.value === "log" ? "log" : "none")}
                      ref={field.ref}
                      value={field.value}
                    />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
            <FormField
              control={blogForm.control}
              name="newsletter.fromEmail"
              render={({ field }) => (
                <SettingsFieldItem label="发件邮箱" optional>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} placeholder="news@example.com" type="email" {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
          </div>
          <FormField
            control={blogForm.control}
            name="newsletter.replyTo"
            render={({ field }) => (
              <SettingsFieldItem label="回复邮箱" optional>
                <FormControl>
                  <Input className={settingsMonoInputClassName} placeholder="reply@example.com" type="email" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <SettingsSaveRow label="保存订阅设置" submitting={blogForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
