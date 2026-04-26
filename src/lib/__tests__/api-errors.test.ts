import { describe, expect, test } from "vitest";

import { isDatabaseConnectionError, toErrorResponse } from "../api-errors";

describe("api error responses", () => {
  test("maps transient database connection failures to a retryable 503", async () => {
    const response = toErrorResponse(new Error("Connection terminated unexpectedly"));

    await expect(response.json()).resolves.toEqual({
      error: "Database connection failed. Please retry shortly.",
    });
    expect(response.status).toBe(503);
  });

  test("detects common pg connection timeout errors", () => {
    expect(isDatabaseConnectionError(new Error("Connection terminated due to connection timeout"))).toBe(true);
    expect(isDatabaseConnectionError(new Error("timeout exceeded when trying to connect"))).toBe(true);
    expect(isDatabaseConnectionError({ code: "ECONNRESET", message: "socket hang up" })).toBe(true);
    expect(isDatabaseConnectionError(new Error("some business error"))).toBe(false);
  });
});
