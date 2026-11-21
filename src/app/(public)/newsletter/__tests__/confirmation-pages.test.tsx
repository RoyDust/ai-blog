import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const dbGuard = vi.hoisted(() => ({
  writeAttempt: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    newsletterSubscriber: {
      create: dbGuard.writeAttempt,
      update: dbGuard.writeAttempt,
      delete: dbGuard.writeAttempt,
    },
  },
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: vi.fn(async () => ({
    siteUrl: "https://blog.example",
  })),
}));

import NewsletterUnsubscribePage from "../unsubscribe/page";
import NewsletterVerifyPage from "../verify/page";

describe("public newsletter confirmation pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("GET /newsletter/verify renders editorial confirmation UI with 0 DB writes and confirms via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { verified: true, status: "verified" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ui = await NewsletterVerifyPage({
      searchParams: Promise.resolve({ token: "verify-token-abc" }),
    });
    render(ui);

    expect(screen.getByRole("heading", { name: "确认邮件订阅" })).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "确认订阅" });
    expect(confirmButton).toHaveClass("home-primary-cta");
    expect(dbGuard.writeAttempt).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/verify",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "verify-token-abc" }),
        }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("邮箱验证已完成");
  });

  test("GET /newsletter/unsubscribe renders editorial confirmation UI with 0 DB writes and unsubscribes via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { unsubscribed: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const ui = await NewsletterUnsubscribePage({
      searchParams: Promise.resolve({ token: "u.payload.sig" }),
    });
    render(ui);

    expect(screen.getByRole("heading", { name: "取消邮件订阅" })).toBeInTheDocument();
    const unsubscribeButton = screen.getByRole("button", { name: "确认退订" });
    expect(unsubscribeButton).toHaveClass("home-primary-cta");
    expect(dbGuard.writeAttempt).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(unsubscribeButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/newsletter/unsubscribe",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ token: "u.payload.sig" }),
        }),
      );
    });
    expect(await screen.findByRole("status")).toHaveTextContent("退订已完成");
  });

  test("renders editorial EmptyState alert without API calls when token query parameter is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const ui = await NewsletterUnsubscribePage({
      searchParams: Promise.resolve({}),
    });
    render(ui);

    expect(screen.getByRole("alert")).toHaveTextContent("缺少退订确认参数");
    expect(screen.queryByRole("button", { name: "确认退订" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
