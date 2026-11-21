"use client";

/**
 * 后台设置页客户端入口。
 *
 * 结构（2026-08 拆分）：
 * - SettingsTablist：顶部 tab 栏（roving tabindex 键盘导航）
 * - AccountSettingsPanel / SiteSettingsPanel / PublicProfileSettingsPanel /
 *   ReadingSettingsPanel / NewsletterSettingsPanel / AboutSettingsPanel / LogSettingsPanel：
 *   各 tab 的独立设置面板（纯展示组件，表单实例与提交动作经 props 注入）
 * - settings-shared：类型、zod schema、tabs 配置与文案工具
 * 主组件只保留表单实例、保存动作与 tab 装配。
 */

import { useState } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { apiMutate, toErrorMessage } from "@/lib/client-api";
import { AccountSettingsPanel } from "@/components/admin/settings/AccountSettingsPanel";
import { AboutSettingsPanel } from "@/components/admin/settings/AboutSettingsPanel";
import { LogSettingsPanel } from "@/components/admin/settings/LogSettingsPanel";
import { NewsletterSettingsPanel } from "@/components/admin/settings/NewsletterSettingsPanel";
import { PublicProfileSettingsPanel } from "@/components/admin/settings/PublicProfileSettingsPanel";
import { ReadingSettingsPanel } from "@/components/admin/settings/ReadingSettingsPanel";
import { SettingsTablist } from "@/components/admin/settings/SettingsTablist";
import { SiteSettingsPanel } from "@/components/admin/settings/SiteSettingsPanel";
import {
  blogSettingsFormSchema,
  logSettingsSchema,
  profileSchema,
  type BlogSettingsDraft,
  type BlogSettingsFormValues,
  type LogSettingsFormValues,
  type OperationLogSettings,
  type ProfileFormValues,
  type SettingsTabId,
  type SettingsUser,
} from "@/components/admin/settings/settings-shared";

interface AdminSettingsClientProps {
  user: SettingsUser;
  blogSettings: BlogSettingsDraft;
  operationLogSettings: OperationLogSettings;
}

export function AdminSettingsClient({ user, blogSettings, operationLogSettings }: AdminSettingsClientProps) {
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user.name ?? "", email: user.email, image: user.image ?? "" },
  });
  const profile = useWatch({ control: profileForm.control }) as ProfileFormValues;

  const blogForm = useForm<BlogSettingsFormValues>({
    resolver: zodResolver(blogSettingsFormSchema),
    defaultValues: blogSettings,
  });
  const blogDraft = useWatch({ control: blogForm.control }) as BlogSettingsFormValues;

  const [logSettings, setLogSettings] = useState(operationLogSettings);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("account");

  const logForm = useForm<LogSettingsFormValues>({
    resolver: zodResolver(logSettingsSchema),
    defaultValues: { maxStorageMb: operationLogSettings.maxStorageMb },
  });
  const initial = (profile.name || profile.email || "A").slice(0, 1).toUpperCase();
  const usagePercent =
    logSettings.maxStorageBytes > 0
      ? Math.min(Math.round((logSettings.currentStorageBytes / logSettings.maxStorageBytes) * 100), 100)
      : 0;

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      const data = await apiMutate<{ data?: ProfileFormValues }>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          image: values.image.trim() || null,
        }),
      });

      if (data.data) {
        profileForm.reset({
          name: data.data.name ?? "",
          email: data.data.email,
          image: data.data.image ?? "",
        });
      }
      toast.success("个人信息已保存");
    } catch (error) {
      toast.error(toErrorMessage(error, "个人信息保存失败，请稍后重试"));
    }
  });

  const saveLogSettings = logForm.handleSubmit(async (values) => {
    try {
      const data = await apiMutate<{ success?: boolean; data?: OperationLogSettings & { deletedCount?: number } }>(
        "/api/admin/settings/operation-logs",
        {
          method: "PATCH",
          body: JSON.stringify({ maxStorageMb: values.maxStorageMb }),
        },
      );

      setLogSettings(data.data ?? logSettings);
      if (data.data) {
        logForm.reset({ maxStorageMb: data.data.maxStorageMb });
      }
      toast.success(data.data?.deletedCount ? `日志设置已保存，已清理 ${data.data.deletedCount} 条旧日志` : "日志设置已保存");
    } catch (error) {
      toast.error(toErrorMessage(error, "日志设置保存失败，请稍后重试"));
    }
  });

  const saveBlogSettings = async (payload: Partial<BlogSettingsDraft>) => {
    try {
      const data = await apiMutate<{ success?: boolean; data?: BlogSettingsDraft }>("/api/admin/settings/blog", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      if (data.data) {
        blogForm.reset(data.data);
      }
      toast.success("博客配置已保存");
    } catch (error) {
      toast.error(toErrorMessage(error, "博客配置保存失败，请稍后重试"));
    }
  };

  const saveSiteSettings = blogForm.handleSubmit((values) =>
    saveBlogSettings({
      siteName: values.siteName,
      siteDescription: values.siteDescription,
      siteUrl: values.siteUrl,
      locale: values.locale,
      appearance: values.appearance,
    }),
  );

  const savePublicProfileSettings = blogForm.handleSubmit((values) =>
    saveBlogSettings({ profile: values.profile }),
  );

  const saveReadingSettings = blogForm.handleSubmit((values) =>
    saveBlogSettings({ reading: values.reading }),
  );

  const saveNewsletterSettings = blogForm.handleSubmit((values) =>
    saveBlogSettings({ newsletter: values.newsletter }),
  );

  const saveAboutSettings = blogForm.handleSubmit((values) =>
    saveBlogSettings({ about: values.about }),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="账号"
        title="设置"
        description="集中管理管理员资料、博客展示信息和后台运行策略。"
      />

      <div className="space-y-5">
        <SettingsTablist activeTab={activeTab} onTabChange={setActiveTab} />

        <div
          aria-labelledby={`settings-tab-${activeTab}`}
          id="settings-panel"
          role="tabpanel"
        >
          {activeTab === "account" ? (
            <AccountSettingsPanel
              user={user}
              profile={profile}
              profileForm={profileForm}
              initial={initial}
              onSubmit={saveProfile}
              onAvatarUploaded={(url) => {
                profileForm.setValue("image", url, { shouldDirty: true, shouldValidate: true });
                toast.success("头像已裁切上传，保存个人信息后生效");
              }}
            />
          ) : null}

          {activeTab === "site" ? (
            <SiteSettingsPanel blogDraft={blogDraft} blogForm={blogForm} onSubmit={saveSiteSettings} />
          ) : null}

          {activeTab === "publicProfile" ? (
            <PublicProfileSettingsPanel blogDraft={blogDraft} blogForm={blogForm} onSubmit={savePublicProfileSettings} />
          ) : null}

          {activeTab === "reading" ? (
            <ReadingSettingsPanel blogForm={blogForm} onSubmit={saveReadingSettings} />
          ) : null}

          {activeTab === "newsletter" ? (
            <NewsletterSettingsPanel blogDraft={blogDraft} blogForm={blogForm} onSubmit={saveNewsletterSettings} />
          ) : null}

          {activeTab === "about" ? (
            <AboutSettingsPanel blogDraft={blogDraft} blogForm={blogForm} onSubmit={saveAboutSettings} />
          ) : null}

          {activeTab === "logs" ? (
            <LogSettingsPanel
              logForm={logForm}
              logSettings={logSettings}
              usagePercent={usagePercent}
              onSubmit={saveLogSettings}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
