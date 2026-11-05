"use client";

import type { UseFormReturn } from "react-hook-form";

import { Form, FormControl, FormField } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { SettingsFieldItem, SettingsGroupTitle, SettingsSaveRow, SettingsSection } from "./SettingsFormParts";
import { fromMultiline, toMultiline, type BlogSettingsFormValues } from "./settings-shared";

type AboutSettingsPanelProps = {
  blogDraft: BlogSettingsFormValues;
  blogForm: UseFormReturn<BlogSettingsFormValues>;
  onSubmit: () => void;
};

/**
 * 「关于页面」设置面板：介绍段落、动态、亮点卡片、技术栈与联系文案。
 * 亮点 / 技术栈从描边框改为组标题（.75rem 700 muted + 细线）下的两列字段。
 * 纯展示组件，表单实例与提交动作经 props 注入。
 */
export function AboutSettingsPanel({ blogDraft, blogForm, onSubmit }: AboutSettingsPanelProps) {
  return (
    <SettingsSection title="关于页面内容" description="同步控制 /about 页面中的介绍、动态、亮点、技术栈和联系文案。">
      <Form {...blogForm}>
        <form className="flex flex-col gap-5" onSubmit={onSubmit}>
          <FormField
            control={blogForm.control}
            name="about.aboutTitle"
            render={({ field }) => (
              <SettingsFieldItem label="关于模块标题">
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="about.aboutParagraphs"
            render={({ field }) => (
              <SettingsFieldItem label="关于模块段落" description="每行一段，最多保存 4 段。">
                <FormControl>
                  <Textarea
                    className="min-h-28 resize-y"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(fromMultiline(event.target.value))}
                    ref={field.ref}
                    value={toMultiline(field.value)}
                  />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="about.nowTitle"
            render={({ field }) => (
              <SettingsFieldItem label="动态模块标题">
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="about.nowItems"
            render={({ field }) => (
              <SettingsFieldItem label="动态条目" description="每行一条，最多保存 6 条。">
                <FormControl>
                  <Textarea
                    className="min-h-28 resize-y"
                    name={field.name}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(fromMultiline(event.target.value))}
                    ref={field.ref}
                    value={toMultiline(field.value)}
                  />
                </FormControl>
              </SettingsFieldItem>
            )}
          />

          {blogDraft.about.highlights.length > 0 ? (
            <div className="flex flex-col gap-4">
              <SettingsGroupTitle>亮点卡片</SettingsGroupTitle>
              {blogDraft.about.highlights.map((_, index) => (
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`highlight-${index}`}>
                  <FormField
                    control={blogForm.control}
                    name={`about.highlights.${index}.title`}
                    render={({ field }) => (
                      <SettingsFieldItem label={`亮点 ${index + 1} 标题`}>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </SettingsFieldItem>
                    )}
                  />
                  <FormField
                    control={blogForm.control}
                    name={`about.highlights.${index}.description`}
                    render={({ field }) => (
                      <SettingsFieldItem label={`亮点 ${index + 1} 描述`}>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </SettingsFieldItem>
                    )}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <FormField
            control={blogForm.control}
            name="about.stackTitle"
            render={({ field }) => (
              <SettingsFieldItem label="技术栈标题">
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />

          {blogDraft.about.stack.length > 0 ? (
            <div className="flex flex-col gap-4">
              <SettingsGroupTitle>技术栈卡片</SettingsGroupTitle>
              {blogDraft.about.stack.map((_, index) => (
                <div className="grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]" key={`stack-${index}`}>
                  <FormField
                    control={blogForm.control}
                    name={`about.stack.${index}.title`}
                    render={({ field }) => (
                      <SettingsFieldItem label={`技术栈 ${index + 1} 标题`}>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </SettingsFieldItem>
                    )}
                  />
                  <FormField
                    control={blogForm.control}
                    name={`about.stack.${index}.description`}
                    render={({ field }) => (
                      <SettingsFieldItem label={`技术栈 ${index + 1} 描述`}>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </SettingsFieldItem>
                    )}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <FormField
            control={blogForm.control}
            name="about.contactTitle"
            render={({ field }) => (
              <SettingsFieldItem label="联系模块标题">
                <FormControl>
                  <Input {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <FormField
            control={blogForm.control}
            name="about.contactDescription"
            render={({ field }) => (
              <SettingsFieldItem label="联系模块描述">
                <FormControl>
                  <Textarea className="min-h-24 resize-y" {...field} />
                </FormControl>
              </SettingsFieldItem>
            )}
          />
          <SettingsSaveRow label="保存博客配置" submitting={blogForm.formState.isSubmitting} />
        </form>
      </Form>
    </SettingsSection>
  );
}
