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

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { editorialEase } from "@/components/editorial";
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
  /** 由服务端页面从 `?tab=` 读出并校验，刷新或分享链接时保留当前页签 */
  initialTab?: SettingsTabId;
  /** GitHub 绑定回跳 `?github=linked` */
  githubJustLinked?: boolean;
}

/**
 * 切换页签时把当前页签写回地址栏 `?tab=`（replaceState，不新增历史记录、不触发路由刷新）。
 * 回跳参数 `github=linked` 只在落地时读一次，切换页签后从地址栏去掉。
 */
function syncTabToUrl(tab: SettingsTabId) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  url.searchParams.delete("github");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export function AdminSettingsClient({
  user,
  blogSettings,
  operationLogSettings,
  initialTab = "account",
  githubJustLinked = false,
}: AdminSettingsClientProps) {
  const reduceMotion = useReducedMotion();
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
  const [activeTab, setActiveTab] = useState<SettingsTabId>(initialTab);
  const handleTabChange = (tab: SettingsTabId) => {
    setActiveTab(tab);
    syncTabToUrl(tab);
  };

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
    <div className="flex flex-col gap-5 pb-2">
      <PageHeader
        eyebrow="账号"
        title="设置"
        description="集中管理管理员资料、博客展示信息和后台运行策略。"
      />

      <div className="flex flex-col gap-6">
        <SettingsTablist activeTab={activeTab} onTabChange={handleTabChange} />

        {/* 换页签时新面板淡入（不等旧面板退出，保持同步渲染） */}
        <motion.div
          key={activeTab}
          aria-labelledby={`settings-tab-${activeTab}`}
          id="settings-panel"
          role="tabpanel"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduceMotion ? 0 : 0.26, ease: editorialEase } }}
        >
          {activeTab === "account" ? (
            <AccountSettingsPanel
              user={user}
              profile={profile}
              profileForm={profileForm}
              initial={initial}
              onSubmit={saveProfile}
              githubJustLinked={githubJustLinked}
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
        </motion.div>
      </div>
    </div>
  );
}
