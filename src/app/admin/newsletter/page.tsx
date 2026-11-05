"use client";

import { useCallback, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { z } from "zod";

import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { MetricStrip } from "@/components/admin/lists";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { collapseMotion } from "@/components/editorial";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";
import { NewsletterDeliveryPanel } from "./NewsletterDeliveryPanel";

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
    sending: number;
    skipped: number;
    unknown: number;
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

const statusMeta: Record<CampaignStatus, { label: string; tone: "muted" | "success" | "warning" | "danger" | "info" }> = {
  DRAFT: { label: "草稿", tone: "muted" },
  SENDING: { label: "发送中", tone: "info" },
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

/** 投递状态：一行等宽计数，已接受 success、失败 danger，其余 muted */
function CampaignDeliveryStats({ stats }: { stats?: CampaignRow["deliveryStats"] }) {
  const items: Array<{ label: string; value: number; className?: string }> = [
    { label: "总计", value: stats?.total ?? 0, className: "text-[var(--text-body)]" },
    { label: "已接受", value: stats?.sent ?? 0, className: "text-[var(--success)]" },
    { label: "失败", value: stats?.failed ?? 0, className: stats?.failed ? "font-bold text-[var(--danger-foreground)]" : undefined },
    { label: "待发送", value: stats?.pending ?? 0 },
    { label: "发送中", value: stats?.sending ?? 0 },
    { label: "未知", value: stats?.unknown ?? 0, className: stats?.unknown ? "font-bold text-[var(--warning)]" : undefined },
    { label: "跳过", value: stats?.skipped ?? 0 },
  ];

  return (
    <span className="flex min-w-0 gap-x-2.5 truncate font-mono text-xs text-[var(--text-muted)] tabular-nums">
      {items.map((item) => (
        <span key={item.label} className={item.className}>
          {item.label} {item.value}
        </span>
      ))}
    </span>
  );
}

export default function AdminNewsletterPage() {
  const { mutate } = useSWRConfig();
  const [busyCampaignId, setBusyCampaignId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
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
  const reduceMotion = useReducedMotion();

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
    if (action === "recover" && !window.confirm("请先在运行环境确认旧发送进程已经停止。恢复不会停止仍在运行的进程。确认已停止后，将未完成尝试标为未知，待核对后处理。")) return;
    try {
      setBusyCampaignId(campaignId);
      await apiMutate(`/api/admin/newsletter/campaigns/${campaignId}/${action}`, { method: "POST", ...(action === "recover" ? { body: JSON.stringify({ senderStopped: true }) } : {}) });

      toast.success(action === "send" ? "邮件发送任务已执行" : action === "retry" ? "失败收件人已重试" : "发送状态已恢复");
    } catch (error) {
      toast.error(
        toErrorMessage(error, action === "send" ? "邮件发送失败" : action === "retry" ? "失败重试失败" : "发送状态恢复失败"),
      );
    } finally {
      setBusyCampaignId(null);
      await Promise.allSettled([mutateCampaigns(), mutate(`/api/admin/newsletter/campaigns/${campaignId}`)]);
    }
  }, [mutateCampaigns, mutate]);

  const columns = useMemo<DataColumn<CampaignRow>[]>(
    () => [
      {
        key: "title",
        label: "邮件活动",
        render: (row) => (
          <span className="flex min-w-0 items-baseline gap-2" title={row.subject}>
            <span className="shrink-0 font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{row.title}</span>
            <span className="min-w-0 truncate text-xs text-[var(--text-muted)]">{row.subject}</span>
          </span>
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
        render: (row) => <CampaignDeliveryStats stats={row.deliveryStats} />,
      },
      {
        key: "posts",
        label: "文章",
        className: "font-mono tabular-nums",
        render: (row) => <span>{row.postIds.length} 篇</span>,
      },
      {
        key: "sentAt",
        label: "发送时间",
        className: "font-mono text-[var(--text-muted)] tabular-nums",
        render: (row) => formatDate(row.sentAt),
      },
      {
        key: "actions",
        label: "操作",
        render: (row) => (
          <span className="flex items-center gap-3">
            <button
              className={adminTextActionClassName}
              disabled={busyCampaignId === row.id || row.status === "SENDING" || row.status === "SENT" || (row.status !== "DRAFT" && !(row.deliveryStats?.pending))}
              onClick={() => void runCampaignAction(row.id, "send")}
              type="button"
            >
              {row.status === "DRAFT" ? "发送" : "继续发送"}
            </button>
            <button
              className={adminTextActionClassName}
              disabled={busyCampaignId === row.id || (row.status !== "PARTIAL_FAILED" && row.status !== "FAILED") || !row.deliveryStats?.failed}
              onClick={() => void runCampaignAction(row.id, "retry")}
              type="button"
            >
              重试失败
            </button>
            <button className={adminTextActionClassName} onClick={() => setSelectedCampaignId(row.id)} type="button">
              {row.deliveryStats?.unknown ? "核对未知" : "收件记录"}
            </button>
            {row.status === "SENDING" ? (
              <button
                className={adminTextActionClassName}
                disabled={busyCampaignId === row.id}
                onClick={() => void runCampaignAction(row.id, "recover")}
                type="button"
              >
                恢复状态
              </button>
            ) : null}
          </span>
        ),
      },
    ],
    [busyCampaignId, runCampaignAction],
  );

  return (
    <div>
      <PageHeader
        eyebrow="增长运营"
        title="邮件运营"
        description="创建文章精选邮件，发送给已验证订阅者，并追踪每次投递结果。"
      />

      <MetricStrip
        ariaLabel="订阅者概况"
        className="mt-1"
        items={[
          { key: "total", label: "全部订阅者", value: subscriberStats.total.toLocaleString("zh-CN"), note: "包含待验证与已退订" },
          { key: "verified", label: "已验证", value: subscriberStats.verified.toLocaleString("zh-CN"), note: "发送活动的目标人群", tone: "success" },
          { key: "pending", label: "待验证", value: subscriberStats.pending.toLocaleString("zh-CN"), note: "等待邮箱确认" },
          { key: "unsubscribed", label: "已退订", value: subscriberStats.unsubscribed.toLocaleString("zh-CN"), note: "不会进入发送队列" },
        ]}
      />

      <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
        已接受仅表示适配器接受，不保证到达邮箱。log 为模拟发送，noop 不发送真实邮件。未知结果不会自动重发。
      </p>

      <AnimatePresence initial={false}>
        {selectedCampaignId ? (
          <motion.div key={selectedCampaignId} className="overflow-hidden" {...(reduceMotion ? {} : collapseMotion)}>
            <NewsletterDeliveryPanel
              campaignId={selectedCampaignId}
              onChanged={() => {
                void mutateCampaigns();
              }}
              onClose={() => setSelectedCampaignId(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_340px]">
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

        <EntityFormShell title="创建邮件活动" description="输入文章 ID 后生成一个可发送的草稿。">
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
                {campaignForm.formState.isSubmitting ? "创建中..." : "创建草稿"}
              </Button>
            </form>
          </Form>
        </EntityFormShell>
      </div>
    </div>
  );
}
