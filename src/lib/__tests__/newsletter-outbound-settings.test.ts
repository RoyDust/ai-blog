import { afterEach, expect, test, vi } from "vitest"

const storage = vi.hoisted(() => ({ readSettings: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRawUnsafe: storage.readSettings } }))

afterEach(() => vi.unstubAllEnvs())

test.each([
  { name: "no stored settings", rows: [] },
  { name: "legacy settings without a provider", rows: [{ value: { newsletter: { enabled: true } } }] },
])("campaigns retain the environment provider with $name", async ({ rows }) => {
  vi.stubEnv("NEWSLETTER_PROVIDER", "log")
  storage.readSettings.mockResolvedValue(rows)
  const { sendNewsletterEmail } = await import("../newsletter-campaigns")
  await expect(sendNewsletterEmail({
    to: "reader@example.com", subject: "Test newsletter", html: "<p>Test</p>", text: "Test",
  })).resolves.toEqual({ delivered: true, provider: "log", simulated: true })
})

test("an explicitly disabled provider overrides the environment provider", async () => {
  vi.stubEnv("NEWSLETTER_PROVIDER", "log")
  storage.readSettings.mockResolvedValue([{ value: { newsletter: { provider: "none" } } }])
  const { sendNewsletterEmail } = await import("../newsletter-campaigns")
  await expect(sendNewsletterEmail({
    to: "reader@example.com", subject: "Test newsletter", html: "<p>Test</p>", text: "Test",
  })).resolves.toEqual({ delivered: false, provider: "noop", reason: "provider_not_configured" })
})

test("campaign delivery honors the newsletter provider saved in admin settings", async () => {
  vi.stubEnv("NEWSLETTER_PROVIDER", "none")
  storage.readSettings.mockResolvedValue([{ value: {
    newsletter: { enabled: true, provider: "log", fromEmail: "test@example.com", replyTo: "" },
  } }])
  const { sendNewsletterEmail } = await import("../newsletter-campaigns")
  await expect(sendNewsletterEmail({
    to: "reader@example.com", subject: "Test newsletter", html: "<p>Test</p>", text: "Test",
  })).resolves.toEqual({ delivered: true, provider: "log", simulated: true })
})
