import { beforeEach, describe, expect, test, vi } from "vitest";

import { ForbiddenError } from "@/lib/api-errors";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
}));

  const campaignMocks = vi.hoisted(() => ({
  createNewsletterCampaign: vi.fn(),
  getNewsletterCampaign: vi.fn(),
  listNewsletterCampaigns: vi.fn(),
  listNewsletterSubscribers: vi.fn(),
  previewNewsletterCampaign: vi.fn(),
  recoverSendingNewsletterCampaign: vi.fn(),
  retryNewsletterCampaignFailures: vi.fn(),
  sendNewsletterCampaign: vi.fn(),
  updateNewsletterCampaign: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: authMocks.requireAdminSession,
}));

vi.mock("@/lib/newsletter-campaigns", () => campaignMocks);

describe("admin newsletter routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("rejects non-admin campaign requests", async () => {
    authMocks.requireAdminSession.mockRejectedValueOnce(new ForbiddenError());

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/newsletter/campaigns"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: "Forbidden" });
    expect(campaignMocks.listNewsletterCampaigns).not.toHaveBeenCalled();
  });

  test("returns paginated campaigns", async () => {
    campaignMocks.listNewsletterCampaigns.mockResolvedValueOnce({
      data: [{ id: "campaign-1", title: "本周精选" }],
      pagination: { page: 2, limit: 20, total: 30, totalPages: 2 },
    });

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/newsletter/campaigns?page=2&limit=20&status=DRAFT&q=精选"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toEqual([{ id: "campaign-1", title: "本周精选" }]);
    expect(campaignMocks.listNewsletterCampaigns).toHaveBeenCalledWith({
      page: "2",
      limit: "20",
      status: "DRAFT",
      q: "精选",
    });
  });

  test("creates a draft campaign for the current admin", async () => {
    campaignMocks.createNewsletterCampaign.mockResolvedValueOnce({
      id: "campaign-1",
      status: "DRAFT",
      title: "本周精选",
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "本周精选",
        subject: "本周精选文章",
        intro: "三篇值得读的文章",
        postIds: ["post-1"],
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.status).toBe("DRAFT");
    expect(campaignMocks.createNewsletterCampaign).toHaveBeenCalledWith({
      title: "本周精选",
      subject: "本周精选文章",
      intro: "三篇值得读的文章",
      postIds: ["post-1"],
      scheduledAt: undefined,
      createdById: "admin-1",
    });
  });

  test("previews campaign content without creating a campaign", async () => {
    campaignMocks.previewNewsletterCampaign.mockResolvedValueOnce({
      subject: "预览",
      html: "<h1>预览</h1>",
      text: "预览",
    });

    const { POST } = await import("../route");
    const response = await POST(new Request("http://localhost/api/admin/newsletter/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent: "preview", subject: "预览", postIds: ["post-1"] }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.html).toBe("<h1>预览</h1>");
    expect(campaignMocks.createNewsletterCampaign).not.toHaveBeenCalled();
  });

  test("sends a campaign by id", async () => {
    campaignMocks.sendNewsletterCampaign.mockResolvedValueOnce({
      id: "campaign-1",
      status: "SENT",
    });

    const { POST } = await import("../[id]/send/route");
    const response = await POST(new Request("http://localhost/api/admin/newsletter/campaigns/campaign-1/send", { method: "POST" }), {
      params: Promise.resolve({ id: "campaign-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.data.status).toBe("SENT");
    expect(campaignMocks.sendNewsletterCampaign).toHaveBeenCalledWith("campaign-1");
  });

  test("retries a campaign by id", async () => {
    campaignMocks.retryNewsletterCampaignFailures.mockResolvedValueOnce({
      id: "campaign-1",
      status: "SENT",
    });

    const { POST } = await import("../[id]/retry/route");
    const response = await POST(new Request("http://localhost/api/admin/newsletter/campaigns/campaign-1/retry", { method: "POST" }), {
      params: Promise.resolve({ id: "campaign-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.data.status).toBe("SENT");
    expect(campaignMocks.retryNewsletterCampaignFailures).toHaveBeenCalledWith("campaign-1");
  });

  test("recovers a stuck sending campaign by id", async () => {
    campaignMocks.recoverSendingNewsletterCampaign.mockResolvedValueOnce({
      id: "campaign-1",
      status: "PARTIAL_FAILED",
    });

    const { POST } = await import("../[id]/recover/route");
    const response = await POST(new Request("http://localhost/api/admin/newsletter/campaigns/campaign-1/recover", { method: "POST" }), {
      params: Promise.resolve({ id: "campaign-1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(202);
    expect(payload.data.status).toBe("PARTIAL_FAILED");
    expect(campaignMocks.recoverSendingNewsletterCampaign).toHaveBeenCalledWith("campaign-1");
  });

  test("returns subscriber rows by status", async () => {
    campaignMocks.listNewsletterSubscribers.mockResolvedValueOnce({
      data: [{ id: "sub-1", email: "reader@example.com", status: "verified" }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      stats: { total: 1, pending: 0, verified: 1, unsubscribed: 0 },
    });

    const { GET } = await import("../../subscribers/route");
    const response = await GET(new Request("http://localhost/api/admin/newsletter/subscribers?status=verified"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.stats.verified).toBe(1);
    expect(campaignMocks.listNewsletterSubscribers).toHaveBeenCalledWith({
      page: null,
      limit: null,
      status: "verified",
      q: null,
    });
  });
});
