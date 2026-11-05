"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button, Input, Textarea } from "@/components/admin/ui";
import { EmptyState } from "@/components/editorial";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

type Delivery = { id: string; email: string; status: string; attemptId: string | null; attemptStartedAt: string | null; error: string | null; simulated: boolean | null; evidenceReference: string | null };
const labels: Record<string, string> = { pending: "待发送", sending: "发送中", sent: "已接受", failed: "失败", skipped: "跳过", unknown: "未知" };
const tones: Record<string, "success" | "danger" | "warning" | "info" | "muted"> = { pending: "muted", sending: "info", sent: "success", failed: "danger", skipped: "muted", unknown: "warning" };
const schema = z.object({
  decision: z.enum(["accepted", "not_accepted", "abandon"]),
  reason: z.string().trim().min(1, "请填写核对或放弃原因").max(2000, "原因最多 2000 字"),
  evidenceReference: z.string().trim().max(2000, "证据引用最多 2000 字"),
  senderStopped: z.boolean().refine((value) => value, "请确认旧发送进程已经停止"),
}).superRefine((value, context) => {
  if (value.decision !== "abandon" && !value.evidenceReference) context.addIssue({ code: "custom", path: ["evidenceReference"], message: "接受或拒绝必须提供上游证据引用" });
});
type ReconciliationForm = z.infer<typeof schema>;

function ReconciliationForm({ campaignId, delivery, onChanged }: { campaignId: string; delivery: Delivery; onChanged: () => void }) {
  const form = useForm<ReconciliationForm>({ resolver: zodResolver(schema), defaultValues: { decision: "accepted", reason: "", evidenceReference: "", senderStopped: false } });
  const decision = useWatch({ control: form.control, name: "decision" });
  async function submit(values: ReconciliationForm) {
    try {
      await apiMutate(`/api/admin/newsletter/campaigns/${campaignId}/deliveries/${delivery.id}/reconcile`, { method: "POST", body: JSON.stringify({
        attemptId: delivery.attemptId, decision: values.decision, reason: values.reason, senderStopped: values.senderStopped,
        ...(values.decision !== "abandon" ? { evidenceKind: values.decision === "accepted" ? "provider_acceptance" : "provider_rejection", evidenceReference: values.evidenceReference } : {}),
      }) });
      toast.success("核对结果已保存"); onChanged();
    } catch (error) { toast.error(toErrorMessage(error, "核对失败，请刷新后重试")); }
  }
  return <Form {...form}><form className="max-w-2xl space-y-4 border-t border-[var(--reader-border-strong)] pt-4" onSubmit={form.handleSubmit(submit)}>
    <p className="font-serif text-base font-bold text-[var(--foreground)]">核对 <span className="font-mono text-[0.875rem]">{delivery.email}</span></p>
    <p className="break-all font-mono text-xs text-[var(--text-muted)]">当前尝试：{delivery.attemptId}；开始时间：{delivery.attemptStartedAt ? new Date(delivery.attemptStartedAt).toLocaleString("zh-CN") : "缺失"}</p>
    <p className="ed-banner ed-banner--warning text-[0.8125rem]">仅凭与当前尝试关联的上游明确接受或拒绝回执核对。本地日志、Message-ID、超时及查无记录均不构成证据。当前 log/noop 不提供真实上游回执查询；无法确认时保留未知，或明确放弃。</p>
    <FormField control={form.control} name="decision" render={({ field }) => <FormItem><FormLabel>核对决定</FormLabel><FormControl><select {...field} className="ed-select w-full"><option value="accepted">上游明确已接受</option><option value="not_accepted">上游明确未接受</option><option value="abandon">放弃发送并跳过</option></select></FormControl><FormMessage /></FormItem>} />
    <FormField control={form.control} name="reason" render={({ field }) => <FormItem><FormLabel>核对或放弃原因</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>} />
    {decision !== "abandon" ? <FormField control={form.control} name="evidenceReference" render={({ field }) => <FormItem><FormLabel>上游证据引用</FormLabel><FormControl><Input {...field} placeholder="与当前尝试关联的供应商回执或工单编号" /></FormControl><FormMessage /></FormItem>} /> : null}
    <FormField control={form.control} name="senderStopped" render={({ field }) => <FormItem><FormLabel className="flex items-center gap-2"><FormControl><input type="checkbox" className="ed-checkbox" checked={field.value} onChange={(event) => field.onChange(event.target.checked)} onBlur={field.onBlur} ref={field.ref} /></FormControl>已在运行环境确认旧发送进程已经停止</FormLabel><FormMessage /></FormItem>} />
    <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "保存中..." : "保存核对结果"}</Button>
  </form></Form>;
}

export function NewsletterDeliveryPanel({ campaignId, onChanged, onClose }: { campaignId: string; onChanged: () => void; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, error, isLoading, mutate } = useSWR<{ data: { title: string; status: string; audienceFrozenAt: string | null; deliveries: Delivery[] } }>(`/api/admin/newsletter/campaigns/${campaignId}`, apiFetcher, { revalidateOnMount: true, onError: (error, key) => { handleGlobalSwrError(error, key); toast.error(toErrorMessage(error, "收件记录加载失败")); } });
  const selected = data?.data.deliveries.find((delivery) => delivery.id === selectedId && delivery.status === "unknown");
  const deliveries = data?.data.deliveries ?? [];
  return <section aria-label="活动收件记录" className="mt-5 space-y-4 border-y border-[var(--reader-border-strong)] py-4">
    <AdminSectionHeader
      aside={<Button type="button" size="sm" variant="outline" onClick={onClose}>关闭记录</Button>}
      title={`${data?.data.title ?? "活动"} · 收件记录`}
    />
    {isLoading ? <p className="text-[0.8125rem] text-[var(--text-muted)]" role="status">正在加载收件记录...</p> : null}
    {error ? <EmptyState actions={<Button type="button" size="sm" variant="outline" onClick={() => void mutate()}>重新加载</Button>} role="alert" title="收件记录加载失败" tone="danger" /> : null}
    {data && !data.data.audienceFrozenAt && data.data.status !== "DRAFT" ? <p className="ed-banner ed-banner--danger" role="alert">历史活动缺少受众快照，需要人工修复，不能重新按当前订阅者发送。</p> : null}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] table-fixed text-left text-sm" data-slot="table">
      <TableHeader><TableRow><TableHead className="w-[32%]">邮箱</TableHead><TableHead className="w-[120px]">状态</TableHead><TableHead>说明 / 证据</TableHead><TableHead className="w-[200px]">操作</TableHead></TableRow></TableHeader>
      <TableBody>{deliveries.map((delivery) => <TableRow key={delivery.id}>
        <TableCell className="truncate font-mono text-[0.8125rem] text-[var(--foreground)]">{delivery.email}</TableCell>
        <TableCell><StatusBadge tone={tones[delivery.status] ?? "muted"}>{labels[delivery.status] ?? delivery.status}{delivery.simulated ? "（模拟）" : ""}</StatusBadge></TableCell>
        <TableCell className="truncate text-[0.8125rem] text-[var(--text-muted)]" title={[delivery.error, delivery.evidenceReference].filter(Boolean).join(" · ") || undefined}>{delivery.error ?? "—"}{delivery.evidenceReference ? <span className="ml-2 font-mono text-xs">{delivery.evidenceReference}</span> : null}</TableCell>
        <TableCell className="truncate">{delivery.status === "unknown" ? <button type="button" className={adminTextActionClassName} disabled={data?.data.status === "SENDING" || !delivery.attemptId || !delivery.attemptStartedAt} onClick={() => setSelectedId(delivery.id)}>核对未知结果</button> : null}{delivery.status === "unknown" && (!delivery.attemptId || !delivery.attemptStartedAt) ? <span className="ml-2 text-xs text-[var(--danger-foreground)]">历史尝试信息缺失，须人工修复</span> : null}</TableCell>
      </TableRow>)}</TableBody>
    </table></div>
    {selected && data?.data.status !== "SENDING" ? <ReconciliationForm key={selected.id + selected.attemptId} campaignId={campaignId} delivery={selected} onChanged={() => { setSelectedId(null); void mutate(); onChanged(); }} /> : null}
  </section>;
}
