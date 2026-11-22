"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form } from "@/components/shadcn/ui/form";
import { fromMultiline, toMultiline, type BlogSettingsFormValues } from "./settings-shared";

type AboutSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「关于页面」设置面板：介绍段落、动态、亮点卡片、技术栈与联系文案。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function AboutSettingsPanel({ blogDraft, blogForm, onSubmit }: AboutSettingsPanelProps) {
  return (
    <Form {...blogForm}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <WorkspacePanel title="关于页面内容" description="同步控制 /about 页面中的介绍、动态、亮点、技术栈和联系文案。">
          <div className="space-y-5">
            <Input
              label="关于模块标题"
              onChange={(event) => blogForm.setValue("about.aboutTitle", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.about.aboutTitle}
            />
            <Textarea
              helperText="每行一段，最多保存 4 段。"
              label="关于模块段落"
              onChange={(event) => blogForm.setValue("about.aboutParagraphs", fromMultiline(event.target.value), { shouldDirty: true, shouldValidate: true })}
              value={toMultiline(blogDraft.about.aboutParagraphs)}
            />
            <Input
              label="动态模块标题"
              onChange={(event) => blogForm.setValue("about.nowTitle", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.about.nowTitle}
            />
            <Textarea
              helperText="每行一条，最多保存 6 条。"
              label="动态条目"
              onChange={(event) => blogForm.setValue("about.nowItems", fromMultiline(event.target.value), { shouldDirty: true, shouldValidate: true })}
              value={toMultiline(blogDraft.about.nowItems)}
            />
            <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">亮点卡片</p>
              {blogDraft.about.highlights.map((item, index) => (
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`highlight-${index}`}>
                  <Input
                    label={`亮点 ${index + 1} 标题`}
                    onChange={(event) => blogForm.setValue(`about.highlights.${index}.title`, event.target.value, { shouldDirty: true, shouldValidate: true })}
                    value={item.title}
                  />
                  <Input
                    label={`亮点 ${index + 1} 描述`}
                    onChange={(event) => blogForm.setValue(`about.highlights.${index}.description`, event.target.value, { shouldDirty: true, shouldValidate: true })}
                    value={item.description}
                  />
                </div>
              ))}
            </div>
            <Input
              label="技术栈标题"
              onChange={(event) => blogForm.setValue("about.stackTitle", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.about.stackTitle}
            />
            <div className="space-y-4 rounded-xl border border-[var(--border)] p-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">技术栈卡片</p>
              {blogDraft.about.stack.map((item, index) => (
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`stack-${index}`}>
                  <Input
                    label={`技术栈 ${index + 1} 标题`}
                    onChange={(event) => blogForm.setValue(`about.stack.${index}.title`, event.target.value, { shouldDirty: true, shouldValidate: true })}
                    value={item.title}
                  />
                  <Input
                    label={`技术栈 ${index + 1} 描述`}
                    onChange={(event) => blogForm.setValue(`about.stack.${index}.description`, event.target.value, { shouldDirty: true, shouldValidate: true })}
                    value={item.description}
                  />
                </div>
              ))}
            </div>
            <Input
              label="联系模块标题"
              onChange={(event) => blogForm.setValue("about.contactTitle", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.about.contactTitle}
            />
            <Textarea
              label="联系模块描述"
              onChange={(event) => blogForm.setValue("about.contactDescription", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.about.contactDescription}
            />
            <div className="flex justify-end">
              <Button disabled={blogForm.formState.isSubmitting} type="submit" variant="outline">
                {blogForm.formState.isSubmitting ? "保存中..." : "保存博客配置"}
              </Button>
            </div>
          </div>
        </WorkspacePanel>
      </form>
    </Form>
  );
}
