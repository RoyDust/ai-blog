import { describe, expect, test } from "vitest";

describe("GET /api/ai/openapi", () => {
  test("returns the ai authoring OpenAPI document", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/ai/openapi"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.openapi).toBe("3.1.0");
    expect(payload.paths["/api/ai/drafts"]).toBeDefined();
    expect(payload.components.securitySchemes.bearerAuth).toEqual({
      type: "http",
      scheme: "bearer",
    });
  });
});
