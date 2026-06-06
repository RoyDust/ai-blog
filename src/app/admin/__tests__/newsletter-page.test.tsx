import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import AdminNewsletterPage from "../newsletter/page";

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
  test("renders campaign list, create form, subscriber summary, send action, and status badges", async () => {
    const fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminNewsletterPage />);

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

    render(<AdminNewsletterPage />);

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
});
