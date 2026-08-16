"use client";

import { type ComponentType, useCallback, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, RefreshCcw, Send, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { WorkspacePanel } from "@/components/admin/primitives/WorkspacePanel";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

type CampaignStatus = "DRAFT" | "SENDING" | "SENT" | "PARTIAL_FAILED" | "FAILED";

type CampaignRow = {
  id: string;
  title: string;
  subject: string;
  intro: string | null;
  postIds: string[];
  status: CampaignStatus;
  sentAt: string | null;
  createdAt: string;
  deliveryStats?: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  };
};

type SubscriberStats = {
  total: number;
  pending: number;
  verified: number;
  unsubscribed: number;
};

type CampaignForm = {
  title: string;
  subject: string;
  intro: string;
  postIds: string;
};

const emptySubscriberStats: SubscriberStats = {
  total: 0,
  pending: 0,
  verified: 0,
  unsubscribed: 0,
};

const initialForm: CampaignForm = {
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

const statusMeta: Record<CampaignStatus, { label: string; tone: "neutral" | "success" | "warning" | "danger" }> = {
  DRAFT: { label: "草稿", tone: "neutral" },
  SENDING: { label: "发送中", tone: "warning" },
  SENT: { label: "已发送", tone: "success" },
  PARTIAL_FAILED: { label: "部分失败", tone: "warning" },
  FAILED: { label: "发送失败", tone: "danger" },
};

function parsePostIds(value: string) {
  return Array.from(new Set(value.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean)));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "未发送";
  }

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</span>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 font-mono text-2xl font-semibold text-[var(--foreground)]">{value.toLocaleString("zh-CN")}</p>
      <p className="mt-2 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

export default function AdminNewsletterPage() {
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const campaignForm = useForm<CampaignForm>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: initialForm,
  });

  const {
    data: campaignsResponse,
    isLoading: campaignsLoading,
    mutate: mutateCampaigns,
  } = useSWR<{ success?: boolean; data?: CampaignRow[] }>(
    "/api/admin/newsletter/campaigns?page=1&limit=20",
    apiFetcher,
    {
      revalidateOnMount: true,
      onError: (swrError, key) => {
        handleGlobalSwrError(swrError, key);
        toast.error(toErrorMessage(swrError, "邮件活动加载失败"));
      },
    },
  );

  const {
    data: subscribersResponse,
    isLoading: subscribersLoading,
  } = useSWR<{ success?: boolean; stats?: SubscriberStats }>(
    "/api/admin/newsletter/subscribers?status=all&limit=5",
    apiFetcher,
    {
      revalidateOnMount: true,
      onError: (swrError, key) => {
        handleGlobalSwrError(swrError, key);
        toast.error(toErrorMessage(swrError, "订阅者数据加载失败"));
      },
    },
  );

  const campaigns = campaignsResponse?.data ?? [];
  const subscriberStats = subscribersResponse?.stats ?? emptySubscriberStats;
  const loading = campaignsLoading || subscribersLoading;

  async function createCampaign(values: CampaignForm) {
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
      campaignForm.reset(initialForm);
      void mutateCampaigns();
    } catch (error) {
      toast.error(toErrorMessage(error, "邮件活动创建失败"));
    }
  }

  const runCampaignAction = useCallback(async (campaignId: string, action: "send" | "retry" | "recover") => {
    try {
      setBusyCampaignId(campaignId);
      await apiMutate(`/api/admin/newsletter/campaigns/${campaignId}/${action}`, { method: "POST" });

      toast.success(action === "send" ? "邮件发送任务已执行" : action === "retry" ? "失败收件人已重试" : "发送状态已恢复");
      void mutateCampaigns();
    } catch (error) {
      toast.error(
        toErrorMessage(error, action === "send" ? "邮件发送失败" : action === "retry" ? "失败重试失败" : "发送状态恢复失败"),
      );
    } finally {
      setBusyCampaignId(null);
    }
  }, [mutateCampaigns]);

  const columns = useMemo<DataColumn<CampaignRow>[]>(
    () => [
      {
        key: "title",
        label: "邮件活动",
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-[var(--foreground)]">{row.title}</p>
            <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{row.subject}</p>
          </div>
        ),
      },
      {
        key: "status",
        label: "状态",
        render: (row) => <StatusBadge tone={statusMeta[row.status].tone}>{statusMeta[row.status].label}</StatusBadge>,
      },
      {
        key: "deliveries",
        label: "投递状态",
        render: (row) => {
          const stats = row.deliveryStats ?? { total: 0, sent: 0, failed: 0, pending: 0 };

          return (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-[var(--surface-alt)] px-2 py-1 text-[var(--text-body)]">总计 {stats.total}</span>
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-700">成功 {stats.sent}</span>
              <span className="rounded-md bg-rose-50 px-2 py-1 text-rose-700">失败 {stats.failed}</span>
            </div>
          );
        },
      },
      {
        key: "posts",
        label: "文章",
        render: (row) => <span>{row.postIds.length} 篇</span>,
      },
      {
        key: "sentAt",
        label: "发送时间",
        render: (row) => formatDate(row.sentAt),
      },
      {
        key: "actions",
        label: "操作",
        render: (row) => (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busyCampaignId === row.id || row.status === "SENDING" || row.status === "SENT" || row.status === "FAILED"}
              onClick={() => void runCampaignAction(row.id, "send")}
              size="xs"
              type="button"
              variant="outline"
            >
              <Send className="h-3 w-3" aria-hidden />
              发送
            </Button>
            <Button
              disabled={busyCampaignId === row.id || (row.status !== "PARTIAL_FAILED" && row.status !== "FAILED")}
              onClick={() => void runCampaignAction(row.id, "retry")}
              size="xs"
              type="button"
              variant="outline"
            >
              <RefreshCcw className="h-3 w-3" aria-hidden />
              重试失败
            </Button>
            {row.status === "SENDING" ? (
              <Button
                disabled={busyCampaignId === row.id}
                onClick={() => void runCampaignAction(row.id, "recover")}
                size="xs"
                type="button"
                variant="outline"
              >
                <RefreshCcw className="h-3 w-3" aria-hidden />
                恢复状态
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [busyCampaignId, runCampaignAction],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="增长运营"
        title="邮件运营"
        description="创建文章精选邮件，发送给已验证订阅者，并追踪每次投递结果。"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard icon={Users} label="全部订阅者" value={subscriberStats.total} hint="包含待验证与已退订" />
        <StatCard icon={MailCheck} label="已验证" value={subscriberStats.verified} hint="发送活动的目标人群" />
        <StatCard icon={Users} label="待验证" value={subscriberStats.pending} hint="等待邮箱确认" />
        <StatCard icon={RefreshCcw} label="已退订" value={subscriberStats.unsubscribed} hint="不会进入发送队列" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <WorkspacePanel
          title="创建邮件活动"
          description="输入文章 ID 后生成一个可发送的草稿。"
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

        <DataTable
          title="邮件活动列表"
          summary="查看活动状态、投递结果，并对失败收件人执行重试。"
          columns={columns}
          rows={campaigns}
          emptyText="暂无邮件活动"
          isLoading={loading}
          loadingLabel="正在加载邮件活动..."
          pageSize={20}
        />
      </div>
    </div>
  );
}
