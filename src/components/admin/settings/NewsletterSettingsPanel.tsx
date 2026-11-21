"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input } from "@/components/admin/ui";
import { Form } from "@/components/shadcn/ui/form";
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
    <Form {...blogForm}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <WorkspacePanel title="邮件订阅" description="控制前台 Newsletter 订阅基础开关和本地日志发送器。">
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
              <input
                checked={blogDraft.newsletter.enabled}
                className="h-4 w-4"
                onChange={(event) => blogForm.setValue("newsletter.enabled", event.target.checked, { shouldDirty: true, shouldValidate: true })}
                type="checkbox"
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--foreground)]">启用订阅入口</span>
                <span className="mt-1 block text-sm text-[var(--muted)]">首页和文章页会读取此开关展示订阅入口。</span>
              </span>
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                helperText="当前只支持 none 和 log；真实邮件供应商会在后续批次接入。"
                label="发送器"
                onChange={(event) =>
                  blogForm.setValue("newsletter.provider", event.target.value === "log" ? "log" : "none", {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                value={blogDraft.newsletter.provider}
              />
              <Input
                label="发件邮箱"
                onChange={(event) => blogForm.setValue("newsletter.fromEmail", event.target.value, { shouldDirty: true, shouldValidate: true })}
                placeholder="news@example.com"
                type="email"
                value={blogDraft.newsletter.fromEmail}
              />
            </div>
            <Input
              label="回复邮箱"
              onChange={(event) => blogForm.setValue("newsletter.replyTo", event.target.value, { shouldDirty: true, shouldValidate: true })}
              placeholder="reply@example.com"
              type="email"
              value={blogDraft.newsletter.replyTo}
            />
            <div className="flex justify-end">
              <Button disabled={blogForm.formState.isSubmitting} type="submit" variant="outline">
                {blogForm.formState.isSubmitting ? "保存中..." : "保存订阅设置"}
              </Button>
            </div>
          </div>
        </WorkspacePanel>
      </form>
    </Form>
  );
}
