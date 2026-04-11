import { describe, expect, test } from "vitest";

describe("GET /llms.txt", () => {
  test("returns a discovery document that points at the ai endpoints", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/llms.txt"));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain("/api/ai/openapi");
    expect(body).toContain("/api/ai/drafts");
    expect(body).toContain("Authorization: Bearer <token>");
  });
});
