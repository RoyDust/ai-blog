import { describe, expect, test } from "vitest";

import { getApiErrorMessage, readApiJson } from "../admin-api-client";

describe("admin api client helpers", () => {
  test("reads error messages from error fields", () => {
    expect(getApiErrorMessage({ error: "Bad request" }, "Fallback")).toBe("Bad request");
  });

  test("falls back when no error message is present", () => {
    expect(getApiErrorMessage({ ok: false }, "Fallback")).toBe("Fallback");
  });

  test("ignores empty error messages", () => {
    expect(getApiErrorMessage({ error: "" }, "Fallback")).toBe("Fallback");
  });

  test("reads successful json payloads", async () => {
    const payload = await readApiJson<{ success: true; data: { id: string } }>(
      new Response(JSON.stringify({ success: true, data: { id: "1" } }), { status: 200 }),
    );

    expect(payload.data.id).toBe("1");
  });

  test("throws api error messages for failed responses", async () => {
    await expect(
      readApiJson(new Response(JSON.stringify({ error: "Nope" }), { status: 400 }), "Fallback"),
    ).rejects.toThrow("Nope");
  });

  test("throws fallback messages for non-json failed responses", async () => {
    await expect(readApiJson(new Response("not json", { status: 500 }), "Fallback")).rejects.toThrow("Fallback");
  });
});
