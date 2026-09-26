import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SWRConfig, mutate as clearSwrCache } from "swr";

import AdminNewsletterPage from "../newsletter/page";

beforeEach(async () => {
  await clearSwrCache(() => true, undefined, { revalidate: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function createFetchMock() {
  return vi.fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "campaign-1",
            title: "本周精选",
            subject: "本周值得读的文章",
            intro: "三篇文章",
            postIds: ["post-1", "post-2"],
            status: "DRAFT",
            sentAt: null,
            createdAt: "2026-06-07T00:00:00.000Z",
            deliveryStats: { total: 0, sent: 0, failed: 0, pending: 0 },
          },
          {
            id: "campaign-2",
            title: "失败重试样本",
            subject: "需要重试的邮件",
            intro: null,
            postIds: ["post-3"],
            status: "PARTIAL_FAILED",
            sentAt: "2026-06-07T01:00:00.000Z",
            createdAt: "2026-06-07T00:00:00.000Z",
            deliveryStats: { total: 3, sent: 2, failed: 1, pending: 0 },
          },
          {
            id: "campaign-3",
            title: "卡住的发送任务",
            subject: "需要恢复的邮件",
            intro: null,
            postIds: ["post-4"],
            status: "SENDING",
            sentAt: null,
            createdAt: "2026-06-07T00:00:00.000Z",
            deliveryStats: { total: 1, sent: 1, failed: 0, pending: 0 },
          },
        ],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 1, limit: 5, total: 4, totalPages: 1 },
        stats: { total: 4, pending: 1, verified: 2, unsubscribed: 1 },
      }),
    });
}

describe("admin newsletter page", () => {
  test.each([false, true])('refreshes open delivery detail after recovery, including a failed response (%s)', async (failedResponse) => {
    let recovered = false;
    const row = { id: 'recover-open', title: 'Recovery detail', subject: 'Recovery', status: 'SENDING', postIds: [], sentAt: null, createdAt: '2026-09-26T00:00:00Z', deliveryStats: { total: 1, sending: 1 } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/recover')) {
        recovered = true;
        return { ok: !failedResponse, status: failedResponse ? 500 : 200, json: async () => failedResponse ? { success: false, error: 'Response failed after persistence' } : { success: true } };
      }
      if (url === '/api/admin/newsletter/campaigns/recover-open') return { ok: true, json: async () => ({ data: { ...row, status: recovered ? 'PARTIAL_FAILED' : 'SENDING', audienceFrozenAt: row.createdAt, deliveries: [{ id: 'delivery', email: 'reader@test.local', status: recovered ? 'unknown' : 'sending', attemptId: 'attempt', attemptStartedAt: row.createdAt }] } }) };
      return { ok: true, json: async () => url.includes('/subscribers?') ? { data: [], stats: emptyStatsForTest } : { data: [{ ...row, status: recovered ? 'PARTIAL_FAILED' : 'SENDING' }] } };
    });
    vi.stubGlobal('fetch', fetchMock);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      renderWithSWR(<AdminNewsletterPage />);
      fireEvent.click(await screen.findByRole('button', { name: '收件记录' }));
      await screen.findByText('reader@test.local');
      expect(screen.queryByRole('button', { name: '核对未知结果' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /恢复状态/ }));
      expect(await screen.findByRole('button', { name: '核对未知结果' })).toBeEnabled();
      expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('campaigns?page='))).toHaveLength(2);
    } finally { confirm.mockRestore(); }
  });

  test("shows every delivery state and requires explicit stopped-sender confirmation before recovery", async () => {
    const fetchMock = createFetchMock().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] }) });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("fetch", fetchMock);
    renderWithSWR(<AdminNewsletterPage />);
    await screen.findByText("本周精选");
    expect(screen.getAllByText("待发送 0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("发送中 0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("未知 0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("跳过 0").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /恢复状态/ }));
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/newsletter/campaigns/campaign-3/recover", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: /恢复状态/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/newsletter/campaigns/campaign-3/recover", expect.objectContaining({ body: JSON.stringify({ senderStopped: true }) })));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("旧发送进程已经停止"));
    confirm.mockRestore();
  });

  test("renders campaign list, create form, subscriber summary, send action, and status badges", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminNewsletterPage />);

    expect(await screen.findByText("邮件运营")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/newsletter/campaigns?page=1&limit=20");
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/newsletter/subscribers?status=all&limit=5");
    expect(screen.getByText("创建邮件活动")).toBeInTheDocument();
    expect(screen.getByLabelText("活动名称")).toBeInTheDocument();
    expect(screen.getByText("全部订阅者")).toBeInTheDocument();
    expect(screen.getByText("已验证")).toBeInTheDocument();
    expect(screen.getByText("本周精选")).toBeInTheDocument();
    expect(screen.getByText("草稿")).toBeInTheDocument();
    expect(screen.getByText("部分失败")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /发送/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /重试失败/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /恢复状态/ })).toBeInTheDocument();
    expect(screen.getByText("失败 1")).toBeInTheDocument();
  });

  test("creates a campaign draft from the form", async () => {
    const fetchMock = createFetchMock()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { id: "campaign-3", status: "DRAFT" } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 1 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: { page: 1, limit: 5, total: 4, totalPages: 1 },
          stats: { total: 4, pending: 1, verified: 2, unsubscribed: 1 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminNewsletterPage />);

    await screen.findByText("本周精选");
    fireEvent.change(screen.getByLabelText("活动名称"), { target: { value: "新活动" } });
    fireEvent.change(screen.getByLabelText("邮件主题"), { target: { value: "新主题" } });
    fireEvent.change(screen.getByLabelText("文章 ID"), { target: { value: "post-1, post-2" } });
    fireEvent.click(screen.getByRole("button", { name: /创建草稿/ }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/newsletter/campaigns", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "新活动",
          subject: "新主题",
          intro: "",
          postIds: ["post-1", "post-2"],
        }),
      }));
    });
  });

  test("shows Chinese field errors and does not submit invalid campaign form", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminNewsletterPage />);

    await screen.findByText("本周精选");
    fireEvent.click(screen.getByRole("button", { name: /创建草稿/ }));

    expect(await screen.findByText("请输入活动名称")).toBeInTheDocument();
    expect(screen.getByText("请输入邮件主题")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/newsletter/campaigns", expect.objectContaining({ method: "POST" }));
  });

  test("disables the create button while campaign submission is pending", async () => {
    let resolveCreate: (response: Response) => void = () => undefined;
    const createResponse = new Promise<Response>((resolve) => {
      resolveCreate = resolve;
    });
    const fetchMock = createFetchMock().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/api/admin/newsletter/campaigns" && init?.method === "POST") {
        return createResponse;
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, data: [], stats: emptyStatsForTest }),
      } as Response);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithSWR(<AdminNewsletterPage />);

    await screen.findByText("本周精选");
    fireEvent.change(screen.getByLabelText("活动名称"), { target: { value: "新活动" } });
    fireEvent.change(screen.getByLabelText("邮件主题"), { target: { value: "新主题" } });
    fireEvent.click(screen.getByRole("button", { name: /创建草稿/ }));

    const pendingButton = await screen.findByRole("button", { name: /创建中/ });
    expect(pendingButton).toBeDisabled();

    resolveCreate({
      ok: true,
      json: async () => ({ success: true, data: { id: "campaign-3", status: "DRAFT" } }),
    } as Response);

    await waitFor(() => expect(screen.getByRole("button", { name: /创建草稿/ })).not.toBeDisabled());
  });
});

const emptyStatsForTest = { total: 0, pending: 0, verified: 0, unsubscribed: 0 };

function renderWithSWR(ui: React.ReactElement) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>,
  );
}
