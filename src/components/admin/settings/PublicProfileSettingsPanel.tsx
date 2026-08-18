"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form } from "@/components/shadcn/ui/form";
import type { BlogSettingsFormValues } from "./settings-shared";

type PublicProfileSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「公开个人信息栏」设置面板：作者副标题/标语/简介/介绍与社交链接。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function PublicProfileSettingsPanel({ blogDraft, blogForm, onSubmit }: PublicProfileSettingsPanelProps) {
  return (
    <Form {...blogForm}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <WorkspacePanel title="公开个人信息栏" description="同步控制前台左侧作者资料卡和关于页头部介绍。">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="作者副标题"
                onChange={(event) => blogForm.setValue("profile.subtitle", event.target.value, { shouldDirty: true, shouldValidate: true })}
                value={blogDraft.profile.subtitle}
              />
              <Input
                label="作者标语"
                onChange={(event) => blogForm.setValue("profile.tagline", event.target.value, { shouldDirty: true, shouldValidate: true })}
                value={blogDraft.profile.tagline}
              />
            </div>
            <Textarea
              label="作者简介"
              onChange={(event) => blogForm.setValue("profile.bio", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.profile.bio}
            />
            <Textarea
              label="作者介绍"
              onChange={(event) => blogForm.setValue("profile.intro", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.profile.intro}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="GitHub 链接"
                onChange={(event) => blogForm.setValue("profile.githubUrl", event.target.value, { shouldDirty: true, shouldValidate: true })}
                value={blogDraft.profile.githubUrl}
              />
              <Input
                label="Twitter / X 链接"
                onChange={(event) => blogForm.setValue("profile.twitterUrl", event.target.value, { shouldDirty: true, shouldValidate: true })}
                value={blogDraft.profile.twitterUrl}
              />
            </div>
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
