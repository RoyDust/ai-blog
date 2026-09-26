import { expect, test, vi } from "vitest"

import { withNewsletterSettings } from "../../../e2e/newsletter-fixtures"

test("newsletter settings are restored after a failed test without overwriting other settings", async () => {
  const original = { enabled: false, provider: "none", fromEmail: "owner@test.local", replyTo: "reply@test.local" }
  let settings = { siteName: "Existing blog", newsletter: original }
  const request = {
    get: vi.fn().mockImplementation(async () => ({ ok: () => true, status: () => 200, json: async () => ({ data: settings }) })),
    patch: vi.fn().mockImplementation(async (_url, { data }) => {
      settings = { ...settings, ...data }
      return { ok: () => true, status: () => 200 }
    }),
  }
  const failure = new Error("subscription assertion failed")

  await expect(withNewsletterSettings(request, async () => {
    expect(settings.newsletter).toMatchObject({ enabled: true, provider: "log" })
    settings.siteName = "Changed while test was running"
    throw failure
  })).rejects.toBe(failure)

  expect(settings).toEqual({ siteName: "Changed while test was running", newsletter: original })
  expect(request.patch).toHaveBeenLastCalledWith("/api/admin/settings/blog", { data: { newsletter: original } })
})
