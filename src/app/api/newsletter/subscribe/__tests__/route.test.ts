import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkInteractionRateLimit: vi.fn(),
  getBlogSettings: vi.fn(),
  subscribe: vi.fn(),
  sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: (request: Request) => Promise<Response>) => handler,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkInteractionRateLimit: mocks.checkInteractionRateLimit,
}));

vi.mock("@/lib/newsletter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/newsletter")>("@/lib/newsletter");

  return {
    ...actual,
    subscribe: mocks.subscribe,
  };
});

vi.mock("@/lib/newsletter-mailer", () => ({
  createNewsletterMailer: vi.fn(() => ({
    provider: "noop",
    configured: false,
    sendVerificationEmail: mocks.sendVerificationEmail,
  })),
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: mocks.getBlogSettings,
}));

describe("POST /api/newsletter/subscribe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkInteractionRateLimit.mockResolvedValue({ allowed: true });
    mocks.getBlogSettings.mockResolvedValue({
      newsletter: {
        enabled: true,
        provider: "none",
        fromEmail: "",
        replyTo: "",
      },
    });
    mocks.subscribe.mockResolvedValue({
      email: "reader@example.com",
      status: "pending",
      verificationToken: "token-1",
    });
    mocks.sendVerificationEmail.mockResolvedValue({
      delivered: false,
      provider: "noop",
      reason: "provider_not_configured",
    });
    process.env.NEXT_PUBLIC_SITE_URL = "https://blog.example";
  });

  test("subscribes a valid email and attempts verification delivery", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({ email: " Reader@Example.com " }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        email: "reader@example.com",
        status: "pending",
        verificationRequired: true,
        mail: {
          delivered: false,
          reason: "provider_not_configured",
        },
      },
    });
    expect(mocks.subscribe).toHaveBeenCalledWith("reader@example.com", {
      ip: "203.0.113.10",
      userAgent: null,
    });
    const { createNewsletterMailer } = await import("@/lib/newsletter-mailer");
    expect(createNewsletterMailer).toHaveBeenCalledWith({
      enabled: true,
      provider: "none",
      fromEmail: "",
      replyTo: "",
    });
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      email: "reader@example.com",
      verificationToken: "token-1",
      verificationUrl: "https://blog.example/api/newsletter/verify?token=token-1",
    });
  });

  test("rejects invalid email before writing", async () => {
    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "invalid" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });

  test("rejects subscription writes when newsletter is disabled in settings", async () => {
    mocks.getBlogSettings.mockResolvedValueOnce({
      newsletter: {
        enabled: false,
        provider: "none",
        fromEmail: "",
        replyTo: "",
      },
    });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(403);
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  test("rate limits subscription attempts", async () => {
    mocks.checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false });

    const { POST } = await import("../route");
    const response = await POST(
      new Request("http://localhost/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "reader@example.com" }),
      }),
    );

    expect(response.status).toBe(429);
    expect(mocks.subscribe).not.toHaveBeenCalled();
  });
});
