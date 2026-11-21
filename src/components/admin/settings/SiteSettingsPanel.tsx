"use client";

import { ImageIcon } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form, FormField, FormItem, FormMessage } from "@/components/shadcn/ui/form";
import { toCssImageUrl, type BlogSettingsFormValues } from "./settings-shared";

type SiteSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「站点基础」设置面板：品牌、描述、地址、语言与前台背景图。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function SiteSettingsPanel({ blogDraft, blogForm, onSubmit }: SiteSettingsPanelProps) {
  return (
    <Form {...blogForm}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <WorkspacePanel title="博客配置" description="同步控制前台头部品牌、底部说明、SEO 信息和机器可读入口。">
          <div className="space-y-4">
            <FormField
              control={blogForm.control}
              name="siteName"
              render={({ field }) => (
                <FormItem>
                  <Input label="博客名称" onChange={field.onChange} value={field.value} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <Textarea
              label="站点描述"
              onChange={(event) => blogForm.setValue("siteDescription", event.target.value, { shouldDirty: true, shouldValidate: true })}
              value={blogDraft.siteDescription}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={blogForm.control}
                name="siteUrl"
                render={({ field }) => (
                  <FormItem>
                    <Input label="站点地址" onChange={field.onChange} value={field.value} />
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Input
                label="默认语言"
                onChange={(event) => blogForm.setValue("locale", event.target.value, { shouldDirty: true, shouldValidate: true })}
                value={blogDraft.locale}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <Input
                helperText="支持站内路径或 http(s) 图片 URL；留空会恢复默认夜景背景。"
                label="前台背景图 URL"
                onChange={(event) =>
                  blogForm.setValue("appearance.backgroundImageUrl", event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                placeholder="/images/fuwari-night-city-bg.svg"
                value={blogDraft.appearance.backgroundImageUrl}
              />
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-alt)]">
                <div
                  aria-hidden="true"
                  className="h-28 bg-cover bg-center"
                  style={{ backgroundImage: toCssImageUrl(blogDraft.appearance.backgroundImageUrl) }}
                />
                <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                  <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>前台顶部背景预览</span>
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-alt)] p-4 text-sm text-[var(--muted)]">
              这些字段会同步到前台导航左侧品牌、页脚说明、站点标题、SEO 描述、RSS、站点地图、默认语言和前台顶部背景。
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
