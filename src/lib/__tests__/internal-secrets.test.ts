import { afterEach, describe, expect, test, vi } from "vitest";

import {
  isValidInternalSecret,
  isWeakSecret,
  readBearerToken,
  requireInternalSecret,
  resolveInternalSecret,
  safeSecretEquals,
} from "../internal-secrets";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.unstubAllEnvs();
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("internal secrets", () => {
  test("compares secrets in constant time and supports any length", () => {
    expect(safeSecretEquals("cron-secret", "cron-secret")).toBe(true);
    expect(safeSecretEquals("cron-secret", "cron-secreX")).toBe(false);
    expect(safeSecretEquals("a", "a")).toBe(true);
    expect(safeSecretEquals("a", "b")).toBe(false);
    // 长度差异也能安全地判定为不相等（摘要后比较，无长度侧信道）。
    expect(safeSecretEquals("short", "a-much-longer-secret-value")).toBe(false);
  });

  test("rejects null or empty secrets without touching crypto", () => {
    expect(safeSecretEquals(null, "x")).toBe(false);
    expect(safeSecretEquals(undefined, "x")).toBe(false);
    expect(safeSecretEquals("", "x")).toBe(false);
    expect(safeSecretEquals("x", null)).toBe(false);
    expect(safeSecretEquals(null, undefined)).toBe(false);
  });

  test("parses bearer tokens from authorization headers", () => {
    expect(readBearerToken(new Request("http://x", { headers: { Authorization: "Bearer abc.123" } }))).toBe("abc.123");
    expect(readBearerToken(new Request("http://x", { headers: { Authorization: "bearer  lower" } }))).toBe("lower");
    expect(readBearerToken(new Request("http://x"))).toBeNull();
    expect(readBearerToken(new Request("http://x", { headers: { Authorization: "Basic abc" } }))).toBeNull();
  });

  test("flags placeholder-like or short secrets as weak", () => {
    expect(isWeakSecret(null)).toBe(true);
    expect(isWeakSecret("short")).toBe(true);
    expect(isWeakSecret("replace-with-a-long-random-secret")).toBe(true);
    expect(isWeakSecret("changeme-please")).toBe(true);
    expect(isWeakSecret("test-secret-12345")).toBe(true);
    expect(isWeakSecret("a-29-char-guessable-phrase-secret")).toBe(false);
    expect(isWeakSecret("k7!xQp9#vL2$zR8@mN4&cT6^")).toBe(false);
  });

  test("warns when production requests use a weak configured secret", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AI_NEWS_CRON_SECRET = "short";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    requireInternalSecret(
      new Request("http://localhost/api/cron/ai-news", {
        headers: { Authorization: "Bearer short" },
      }),
      { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] },
    );

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("AI_NEWS_CRON_SECRET looks weak or placeholder-like"),
    );
  });

  test("resolves the first non-empty env var in the fallback chain", () => {
    delete process.env.FIRST_KEY;
    delete process.env.SECOND_KEY;

    process.env.FIRST_KEY = "first-secret";
    process.env.SECOND_KEY = "second-secret";
    expect(resolveInternalSecret(["FIRST_KEY", "SECOND_KEY"])).toBe("first-secret");

    delete process.env.FIRST_KEY;
    expect(resolveInternalSecret(["FIRST_KEY", "SECOND_KEY"])).toBe("second-secret");

    process.env.SECOND_KEY = "   ";
    expect(resolveInternalSecret(["FIRST_KEY", "SECOND_KEY"])).toBeNull();
  });

  test("requireInternalSecret throws 503 when no env var is configured", () => {
    delete process.env.AI_NEWS_CRON_SECRET;

    const request = new Request("http://localhost/api/cron/ai-news", {
      headers: { Authorization: "Bearer whatever" },
    });

    expect(() =>
      requireInternalSecret(request, { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] }),
    ).toThrowError(expect.objectContaining({ status: 503, message: "Internal service secret is not configured" }));
  });

  test("requireInternalSecret throws 401 on a mismatched bearer token", () => {
    process.env.AI_NEWS_CRON_SECRET = "correct-secret";

    const request = new Request("http://localhost/api/cron/ai-news", {
      headers: { Authorization: "Bearer wrong-secret" },
    });

    expect(() =>
      requireInternalSecret(request, { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] }),
    ).toThrowError(expect.objectContaining({ status: 401 }));
  });

  test("requireInternalSecret accepts a matching bearer token and custom headers", () => {
    process.env.AI_NEWS_CRON_SECRET = "correct-secret";
    process.env.OPERATION_LOG_INGEST_SECRET = "ingest-secret";

    const bearerRequest = new Request("http://localhost/api/cron/ai-news", {
      headers: { Authorization: "Bearer correct-secret" },
    });
    expect(() =>
      requireInternalSecret(bearerRequest, { secretName: "AI_NEWS_CRON_SECRET", envKeys: ["AI_NEWS_CRON_SECRET"] }),
    ).not.toThrow();

    const headerRequest = new Request("http://localhost/api/internal/operation-logs", {
      headers: { "x-operation-log-ingest-secret": "ingest-secret" },
    });
    expect(() =>
      requireInternalSecret(headerRequest, {
        secretName: "OPERATION_LOG_INGEST_SECRET",
        envKeys: ["OPERATION_LOG_INGEST_SECRET"],
        header: "x-operation-log-ingest-secret",
      }),
    ).not.toThrow();
  });

  test("isValidInternalSecret reports match / mismatch / missing configuration", () => {
    delete process.env.OPERATION_LOG_INGEST_SECRET;

    expect(isValidInternalSecret("anything", ["OPERATION_LOG_INGEST_SECRET"])).toBe(false);

    process.env.OPERATION_LOG_INGEST_SECRET = "ingest-secret";
    expect(isValidInternalSecret("ingest-secret", ["OPERATION_LOG_INGEST_SECRET"])).toBe(true);
    expect(isValidInternalSecret("wrong", ["OPERATION_LOG_INGEST_SECRET"])).toBe(false);
    expect(isValidInternalSecret(null, ["OPERATION_LOG_INGEST_SECRET"])).toBe(false);
  });
});
