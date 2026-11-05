"use client";

import type { UseFormReturn } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { SettingsFieldItem, SettingsNote, SettingsSaveRow, SettingsSection, settingsMonoInputClassName } from "./SettingsFormParts";
import { toCssImageUrl, type BlogSettingsFormValues } from "./settings-shared";

type SiteSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「站点基础」设置面板（方向 A 第 15 节 F1）：博客名称、站点描述、站点地址 / 默认语言、
 * 前台背景图 URL 与 18rem 预览，左侧 2px 竖线说明，底部右侧实心「保存博客配置」。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function SiteSettingsPanel({ blogDraft, blogForm, onSubmit }: SiteSettingsPanelProps) {
  return (
    <SettingsSection title="博客配置" description="同步控制前台头部品牌、底部说明、SEO 信息和机器可读入口。">
      <Form {...blogForm}>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <FormField
            control={blogForm.control}
            name="siteName"
            render={({ field }) => (
              <SettingsFieldItem label="博客名称" required>
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="siteDescription"
            render={({ field }) => (
              <SettingsFieldItem label="站点描述">
                <FormControl>
                  <Textarea className="min-h-20 resize-y" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-[minmax(0,1fr)_10rem]">
            <FormField
              control={blogForm.control}
              name="siteUrl"
              render={({ field }) => (
                <SettingsFieldItem label="站点地址" required>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
            <FormField
              control={blogForm.control}
              name="locale"
              render={({ field }) => (
                <SettingsFieldItem label="默认语言" required>
                  <FormControl>
                    <Input className={settingsMonoInputClassName} {...field} />
                  </FormControl>
                </SettingsFieldItem>
              )}
            />
          </div>
          <FormField
            control={blogForm.control}
            name="appearance.backgroundImageUrl"
            render={({ field }) => (
              <SettingsFieldItem
                label="前台背景图 URL"
                optional
                description="支持站内路径或 http(s) 图片 URL；留空会恢复默认夜景背景。"
              >
                <FormControl>
                  <Input className={settingsMonoInputClassName} placeholder="/images/fuwari-night-city-bg.svg" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <figure className="relative overflow-hidden rounded-[var(--radius-ctl)] border border-[var(--border)] bg-[var(--ed-skeleton)]">
            <div
              aria-hidden="true"
              className="h-72 bg-cover bg-center transition-[background-image] duration-300"
              style={{ backgroundImage: toCssImageUrl(blogDraft.appearance.backgroundImageUrl) }}
            />
            <figcaption className="absolute bottom-2 left-3 rounded-[2px] bg-[color-mix(in_oklab,var(--card-bg)_82%,transparent)] px-1.5 py-0.5 text-[0.6875rem] font-bold text-[var(--text-muted)]">
              前台顶部背景预览
            </figcaption>
          </figure>
          <SettingsNote>
            这些字段会同步到前台导航左侧品牌、页脚说明、站点标题、SEO 描述、RSS、站点地图、默认语言和前台顶部背景。
          </SettingsNote>
          <SettingsSaveRow label="保存博客配置" submitting={blogForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
