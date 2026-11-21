"use client";

import type { UseFormReturn } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { SettingsFieldItem, SettingsSaveRow, SettingsSection, settingsMonoInputClassName } from "./SettingsFormParts";
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
export function PublicProfileSettingsPanel({ blogForm, onSubmit }: PublicProfileSettingsPanelProps) {
  return (
    <SettingsSection title="公开个人信息栏" description="同步控制前台左侧作者资料卡和关于页头部介绍。">
      <Form {...blogForm}>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <FormField
              control={blogForm.control}
              name="profile.subtitle"
              render={({ field }) => (
                <SettingsFieldItem label="作者副标题" optional>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
            <FormField
              control={blogForm.control}
              name="profile.tagline"
              render={({ field }) => (
                <SettingsFieldItem label="作者标语" optional>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
          </div>
          <FormField
            control={blogForm.control}
            name="profile.bio"
            render={({ field }) => (
              <SettingsFieldItem label="作者简介" optional>
                <FormControl>
                  <Textarea className="min-h-24 resize-y" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="profile.intro"
            render={({ field }) => (
              <SettingsFieldItem label="作者介绍" optional>
                <FormControl>
                  <Textarea className="min-h-24 resize-y" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <FormField
              control={blogForm.control}
              name="profile.githubUrl"
              render={({ field }) => (
                <SettingsFieldItem label="GitHub 链接" optional>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
            <FormField
              control={blogForm.control}
              name="profile.twitterUrl"
              render={({ field }) => (
                <SettingsFieldItem label="Twitter / X 链接" optional>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
          </div>
          <SettingsSaveRow label="保存博客配置" submitting={blogForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
