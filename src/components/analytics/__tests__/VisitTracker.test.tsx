import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const pathnameState = vi.hoisted(() => ({ value: "/posts/ai-architecture" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

import { sanitizeVisitReferrer, VisitTracker } from "../VisitTracker";

describe("VisitTracker referrer scrubbing", () => {
  beforeEach(() => {
    pathnameState.value = "/posts/ai-architecture";
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("sanitizeVisitReferrer strips ?search and #hash while preserving origin + pathname", () => {
    expect(
      sanitizeVisitReferrer("https://inkforge.example/newsletter/unsubscribe?token=secret-123#done"),
    ).toBe("https://inkforge.example/newsletter/unsubscribe");
    expect(sanitizeVisitReferrer("https://example.com?utm_source=weekly#top")).toBe("https://example.com");
    expect(sanitizeVisitReferrer("https://example.com/?utm_source=weekly")).toBe("https://example.com/");
    expect(sanitizeVisitReferrer("/newsletter/verify?token=secret-456#ok")).toBe("/newsletter/verify");
    expect(sanitizeVisitReferrer("javascript:alert(1)")).toBeNull();
    expect(sanitizeVisitReferrer("")).toBeNull();
  });

  test("sends sanitized referrer without magic-link query/hash tokens and tolerates disabled localStorage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "http://localhost:3000/newsletter/verify?token=sensitive-magic-token#step-2",
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });

    render(<VisitTracker />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/analytics/visit");
    const body = JSON.parse(String(init.body)) as { path: string; referrer: string | null; visitorId: string };
    expect(body.path).toBe("/posts/ai-architecture");
    expect(body.referrer).toBe("http://localhost:3000/newsletter/verify");
    expect(body.referrer).not.toContain("sensitive-magic-token");
    expect(body.visitorId).toBeTruthy();
  });
});
