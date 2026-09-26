import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SWRConfig, mutate as clearSwrCache } from "swr";
import { NewsletterDeliveryPanel } from "../newsletter/NewsletterDeliveryPanel";

const campaign = { title: "未知结果活动", status: "PARTIAL_FAILED", audienceFrozenAt: "2026-09-26T00:00:00Z", deliveries: [{
  id: "delivery-1", email: "reader@example.com", status: "unknown", attemptId: "attempt-1", attemptStartedAt: "2026-09-26T00:00:00Z", error: "timeout", simulated: null, evidenceReference: null,
}] };
beforeEach(async () => { await clearSwrCache(() => true, undefined, { revalidate: false }); });
afterEach(() => vi.unstubAllGlobals());
function mount() {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: campaign }) });
  vi.stubGlobal("fetch", fetch);
  const onChanged = vi.fn();
  render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}><NewsletterDeliveryPanel campaignId="campaign-1" onChanged={onChanged} onClose={() => {}} /></SWRConfig>);
  return { fetch, onChanged };
}
describe("Newsletter unknown result reconciliation", () => {
  test("requires evidence, reason and stopped-sender confirmation before accepting an observed attempt", async () => {
    const { fetch, onChanged } = mount();
    fireEvent.click(await screen.findByRole("button", { name: "核对未知结果" }));
    fireEvent.click(screen.getByRole("button", { name: "保存核对结果" }));
    expect(await screen.findByText("接受或拒绝必须提供上游证据引用")).toBeInTheDocument();
    expect(screen.getByText("请填写核对或放弃原因")).toBeInTheDocument();
    expect(screen.getByText("请确认旧发送进程已经停止")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText("核对或放弃原因"), { target: { value: "已人工确认供应商回执" } });
    fireEvent.change(screen.getByLabelText("上游证据引用"), { target: { value: "provider:receipt-123" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/newsletter/campaigns/campaign-1/deliveries/delivery-1/reconcile", expect.objectContaining({ method: "POST", body: JSON.stringify({ attemptId: "attempt-1", decision: "accepted", reason: "已人工确认供应商回执", senderStopped: true, evidenceKind: "provider_acceptance", evidenceReference: "provider:receipt-123" }) })));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  test("an explicit abandonment records its reason without inventing provider evidence", async () => {
    const { fetch } = mount();
    fireEvent.click(await screen.findByRole("button", { name: "核对未知结果" }));
    fireEvent.change(screen.getByLabelText("核对决定"), { target: { value: "abandon" } });
    expect(screen.queryByLabelText("上游证据引用")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("核对或放弃原因"), { target: { value: "无法取得凭据，明确放弃" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/newsletter/campaigns/campaign-1/deliveries/delivery-1/reconcile", expect.objectContaining({ body: JSON.stringify({ attemptId: "attempt-1", decision: "abandon", reason: "无法取得凭据，明确放弃", senderStopped: true }) })));
  });
});
