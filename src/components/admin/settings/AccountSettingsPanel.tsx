"use client";

import type { UseFormReturn } from "react-hook-form";

import { ImageCropUploadDialog } from "@/components/admin/ui";
import { FadeBanner } from "@/components/admin/workspace/WorkspaceKit";
import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { GitHubBinding } from "@/components/admin/settings/GitHubBinding";
import { SettingsFieldItem, SettingsSaveRow, SettingsSection, settingsMonoInputClassName } from "./SettingsFormParts";
import type { ProfileFormValues, SettingsUser } from "./settings-shared";

type AccountSettingsPanelProps = {
  user: SettingsUser;
  profile: ProfileFormValues;
  profileForm: UseFormReturn<ProfileFormValues>;
  initial: string;
  onSubmit: () => void;
  onAvatarUploaded: (url: string) => void;
  /** GitHub 绑定回跳（?github=linked）后显示一次成功提示 */
  githubJustLinked?: boolean;
};

/**
 * 「账号资料」设置面板（方向 A 第 15 节 F）：身份行（64px 圆形头像即裁切按钮 + 衬线名称、等宽邮箱、一行提示）、
 * 显示名称 / 邮箱两列、头像 URL（可选）、GitHub 绑定细线行，底部左「角色」右实心「保存个人信息」。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function AccountSettingsPanel({
  user,
  profile,
  profileForm,
  initial,
  onSubmit,
  onAvatarUploaded,
  githubJustLinked = false,
}: AccountSettingsPanelProps) {
  return (
    <SettingsSection title="个人信息" description="用于后台账号展示，也会影响作者署名的默认显示。">
      <FadeBanner message={githubJustLinked ? "GitHub 账号已绑定，可使用 GitHub 登录。" : ""} tone="success" />
      <Form {...profileForm}>
        <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
          <div className="flex items-center gap-5">
            <ImageCropUploadDialog
              currentImage={profile.image}
              fallbackText={initial}
              outputFileName={`avatar-${user.id}.webp`}
              triggerLabel="裁切并上传新头像"
              onUploaded={onAvatarUploaded}
            />
            <div className="min-w-0">
              <p className="truncate font-serif text-lg font-bold text-[var(--foreground)]">{profile.name || "未命名管理员"}</p>
              <p className="mt-0.5 truncate font-mono text-[0.8125rem] text-[var(--text-muted)]">{profile.email}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">点击头像裁切并上传新图片</p>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <SettingsFieldItem label="显示名称" required>
                  <FormControl>
                    <Input placeholder="例如 Inkforge" {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
            <FormField
              control={profileForm.control}
              name="email"
              render={({ field }) => (
                <SettingsFieldItem label="邮箱" required>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} placeholder="admin@example.com" type="email" {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
          </div>

          <FormField
            control={profileForm.control}
            name="image"
            render={({ field }) => (
              <SettingsFieldItem
                label="头像 URL"
                optional
                description="可手动填写远程图片 URL，也可以点击头像裁切上传。留空会移除头像。"
              >
                <FormControl>
                  <Input className={settingsMonoInputClassName} placeholder="https://example.com/avatar.png" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />

          <GitHubBinding initialLinked={user.githubLinked} />

          <SettingsSaveRow
            label="保存个人信息"
            submitting={profileForm.formState.isSubmitting}
            aside={<>角色：{user.role === "ADMIN" ? "管理员" : user.role}</>}
          />
        </form>
      </Form>
    </SettingsSection>
  );
}
