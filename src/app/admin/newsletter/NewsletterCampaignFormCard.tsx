"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/coss/ui/form";
import { apiMutate, toErrorMessage } from "@/lib/client-api";

type CampaignFormValues = {
  title: string;
  subject: string;
  intro: string;
  postIds: string;
};

const initialFormValues: CampaignFormValues = {
  title: "",
  subject: "",
  intro: "",
  postIds: "",
};

const campaignFormSchema = z.object({
  title: z.string().trim().min(1, "请输入活动名称"),
  subject: z.string().trim().min(1, "请输入邮件主题"),
  intro: z.string(),
  postIds: z.string(),
});

function parsePostIds(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\s,，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function NewsletterCampaignFormCard({ onCreated }: { onCreated: () => void }) {
  const campaignForm = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: initialFormValues,
  });

  async function createCampaign(values: CampaignFormValues) {
    try {
      await apiMutate("/api/admin/newsletter/campaigns", {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          subject: values.subject,
          intro: values.intro,
          postIds: parsePostIds(values.postIds),
        }),
      });

      toast.success("邮件活动草稿已创建");
      campaignForm.reset(initialFormValues);
      onCreated();
    } catch (error) {
      toast.error(toErrorMessage(error, "邮件活动创建失败"));
    }
  }

  return (
    <WorkspacePanel
      title="创建邮件活动"
      description="输入文章 ID 生成草稿，在列表中手动触发异步发送（定时自动调度暂未开放）。"
      fillHeight={false}
    >
      <Form {...campaignForm}>
        <form className="space-y-4" onSubmit={campaignForm.handleSubmit(createCampaign)}>
          <FormField
            control={campaignForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>活动名称</FormLabel>
                <FormControl>
                  <Input placeholder="本周精选" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={campaignForm.control}
            name="subject"
            render={({ field }) => (
              <FormItem>
                <FormLabel>邮件主题</FormLabel>
                <FormControl>
                  <Input placeholder="本周值得读的文章" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={campaignForm.control}
            name="intro"
            render={({ field }) => (
              <FormItem>
                <FormLabel>开场说明</FormLabel>
                <FormControl>
                  <Textarea placeholder="写给订阅者的一段简短导语" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={campaignForm.control}
            name="postIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>文章 ID</FormLabel>
                <FormControl>
                  <Input placeholder="post-1, post-2" {...field} />
                </FormControl>
                <FormDescription>用逗号或换行分隔多个已发布文章 ID。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button disabled={campaignForm.formState.isSubmitting} type="submit">
            <MailCheck className="h-4 w-4" aria-hidden />
            {campaignForm.formState.isSubmitting ? "创建中..." : "创建草稿"}
          </Button>
        </form>
      </Form>
    </WorkspacePanel>
  );
}
