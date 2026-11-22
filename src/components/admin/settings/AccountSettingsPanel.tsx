"use client";

import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, ImageCropUploadDialog, Input } from "@/components/admin/ui";
import { Form, FormField, FormItem, FormMessage } from "@/components/shadcn/ui/form";
import { GitHubBinding } from "@/components/admin/settings/GitHubBinding";
import type { ProfileFormValues, SettingsUser } from "./settings-shared";

type AccountSettingsPanelProps = {
  user: SettingsUser;
  profile: ProfileFormValues;
  profileForm: UseFormReturn<ProfileFormValues>;
  initial: string;
  onSubmit: () => void;
  onAvatarUploaded: (url: string) => void;
};

/**
 * 「账号资料」设置面板：头像裁切上传、显示名称/邮箱/头像 URL、GitHub 绑定。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function AccountSettingsPanel({
  user,
  profile,
  profileForm,
  initial,
  onSubmit,
  onAvatarUploaded,
}: AccountSettingsPanelProps) {
  return (
    <WorkspacePanel title="个人信息" description="用于后台账号展示，也会影响作者署名的默认显示。">
      <Form {...profileForm}>
        <form className="space-y-5" noValidate onSubmit={onSubmit}>
          <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
            <ImageCropUploadDialog
              currentImage={profile.image}
              fallbackText={initial}
              outputFileName={`avatar-${user.id}.webp`}
              onUploaded={onAvatarUploaded}
            />
            <div className="min-w-0">
              <p className="font-semibold text-[var(--foreground)]">{profile.name || "未命名管理员"}</p>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{profile.email}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">点击头像裁切并上传新图片</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <Input
                    label="显示名称"
                    onChange={field.onChange}
                    placeholder="例如 Inkforge"
                    value={field.value}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <Input
                    label="邮箱"
                    onChange={field.onChange}
                    placeholder="admin@example.com"
                    type="email"
                    value={field.value}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={profileForm.control}
            name="image"
            render={({ field }) => (
              <FormItem>
                <Input
                  helperText="可手动填写远程图片 URL，也可以点击头像裁切上传。留空会移除头像。"
                  label="头像 URL"
                  onChange={field.onChange}
                  placeholder="https://example.com/avatar.png"
                  value={field.value}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <GitHubBinding initialLinked={user.githubLinked} />

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-[var(--muted)]">角色：{user.role === "ADMIN" ? "管理员" : user.role}</p>
            <Button disabled={profileForm.formState.isSubmitting} type="submit">
              {profileForm.formState.isSubmitting ? "保存中..." : "保存个人信息"}
            </Button>
          </div>
        </form>
      </Form>
    </WorkspacePanel>
  );
}
